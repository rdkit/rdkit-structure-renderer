// Copyright (c) 2022-2023, Novartis Institutes for BioMedical Research
//
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Novartis Institutes for BioMedical Research Inc.
//       nor the names of its contributors may be used to endorse or promote
//       products derived from this software without specific prior written
//       permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

import Utils from './utils';
import { JOB_TYPES } from './constants';

const {
    extractBase64Pickle,
    getMolFromUInt8Array,
    getPickleSafe,
    isBase64Pickle,
    isMolBlock,
    splitMolText,
} = Utils;

const Depiction = {
    extractBase64Pickle,
    getMolFromUInt8Array,
    getPickleSafe,
    isBase64Pickle,
    isMolBlock,
    splitMolText,

    /**
     * Generate molecule from SMILES, CTAB or pkl_base64.
     * @param {object} rdkitModule
     * @param {string} molText SMILES, CTAB or pkl_base64
     * @param {object} getMolOpts optional, dict of options
     * passed to get_mol (defaults to {})
     * @returns {JSMol} molecule or null in case of failure
     */
    getMolSafe(rdkitModule, molText, getMolOpts) {
        if (this.isBase64Pickle(molText)) {
            const molPickle = this.extractBase64Pickle(molText);
            return this.getMolFromUInt8Array(rdkitModule, molPickle);
        }
        const FALLBACK_OPS = [{ kekulize: false }, { sanitize: false }, { query: true }];
        // this is called recursively until success
        // or until FALLBACK_OPS are available
        const _getMolSafe = (opIdxIn) => {
            let opIdx = opIdxIn;
            let exc = '';
            let mol = null;
            const opts = getMolOpts || {};
            let op;
            let shouldTry = true;
            if (typeof opIdx === 'number') {
                shouldTry = false;
                // eslint-disable-next-line prefer-destructuring
                op = Object.entries(FALLBACK_OPS[opIdx])[0];
                if (opts[op[0]] !== op[1]) {
                    shouldTry = true;
                    // eslint-disable-next-line prefer-destructuring
                    opts[op[0]] = op[1];
                }
            } else {
                opIdx = -1;
            }
            if (shouldTry) {
                try {
                    mol = opts.query ? rdkitModule.get_qmol(molText)
                        : rdkitModule.get_mol(molText, JSON.stringify(opts));
                } catch (e) {
                    exc = ` (${e})`;
                }
            }
            if (!mol) {
                while (++opIdx < FALLBACK_OPS.length && opts[FALLBACK_OPS[opIdx]]);
                if (opIdx < FALLBACK_OPS.length) {
                    return _getMolSafe(opIdx);
                }
                console.error(`Failed to generate RDKit mol${exc}`);
            } else if (op && op[0] !== 'query') {
                console.warn(`Failed to ${op[0]} RDKit mol${exc}`);
            }
            return mol;
        };
        return _getMolSafe();
    },

    /**
     * Generate JSMolList from a pipe-separated list of SMILES/pkl_base64 or
     * '$$$$'-separated list of CTABs.
     * @param {object} rdkitModule
     * @param {string} molText mol description (SMILES, molblock or pkl_base64).
     * The description may include multiple mols, either separated by a pipe symbol
     * ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} getMolOpts optional, dict of options
     * passed to get_mol (defaults to {})
     * @returns {JSMolList} JSMolList or null in case of failure
     */
    getMolListSafe(rdkitModule, molText, getMolOpts) {
        const molTextArray = this.splitMolText(molText);
        const molArray = molTextArray.map(
            (molTextItem) => this.getMolSafe(rdkitModule, molTextItem, getMolOpts)
        );
        return this.getMolListFromMolArray(rdkitModule, molArray);
    },

    /**
     * Generate JSMolList from an array of UInt8Array representing
     * pickled molecules.
     * @param {Array<UInt8Array>} molArray array of pickled molecules
     * @returns {JSMolList} JSMolList or null in case of failure
     * or empty input array
     */
    getMolListFromUInt8ArrayArray(rdkitModule, molPickleArray) {
        if (!Array.isArray(molPickleArray)) {
            return null;
        }
        const molArray = molPickleArray.map(
            (molPickle) => this.getMolFromUInt8Array(rdkitModule, molPickle)
        );
        return this.getMolListFromMolArray(rdkitModule, molArray);
    },

    /**
     * Generate JSMolList from an array of JSMol.
     * @param {Array<JSMol>} molArray array of JSMol
     * @returns {JSMolList} JSMolList or null in case of failure
     * or empty input array
     */
    getMolListFromMolArray(rdkitModule, molArray) {
        if (!Array.isArray(molArray) || !molArray.length) {
            return null;
        }
        const molList = new rdkitModule.MolList();
        if (!molList) {
            console.error('Failed to initialize empty MolList');
            return null;
        }
        molArray.forEach((mol) => {
            if (mol) {
                try {
                    molList.append(mol);
                } finally {
                    mol.delete();
                }
            }
        });
        return molList;
    },

    /**
     * Generate JSMolList from a JSMol potentially
     * containing multiple disconnected fragments.
     * @param {JSMol} mol RDKit JSMol
     * @returns {JSMolList} molecule list or null in case of failure
     */
    getFragsSafe(mol, getFragsOpts) {
        const FALLBACK_OPS = ['sanitizeFrags'];
        // this is called recursively until success
        // or until FALLBACK_OPS are available
        const _getFragsSafe = (opIdxIn) => {
            let opIdx = opIdxIn;
            let exc = '';
            let res = null;
            const opts = getFragsOpts || {};
            let op;
            let shouldTry = true;
            if (typeof opIdx === 'number') {
                shouldTry = false;
                op = FALLBACK_OPS[opIdx];
                if (opts[op] !== false) {
                    shouldTry = true;
                    opts[op] = false;
                }
            } else {
                opIdx = -1;
            }
            if (shouldTry) {
                try {
                    res = mol.get_frags(JSON.stringify(opts));
                } catch (e) {
                    exc = ` (${e})`;
                }
            }
            if (!res) {
                if (++opIdx < FALLBACK_OPS.length) {
                    return _getFragsSafe(opIdx);
                }
                console.error(`Failed to get frags from RDKit mol${exc}`);
            } else if (op) {
                console.error(`Failed to run ${op}`);
            }
            return res;
        };
        return _getFragsSafe();
    },

    /**
     * Add coordinates to the passed molecule.
     * @param {JSMol} mol input molecule
     * @param {boolean} useCoordGen whether new coordinates
     * should be generated with CoordGen
     * @returns {boolean} true if success, false if failure
     */
    setNewCoords(mol, useCoordGen) {
        let res = false;
        let exc = '';
        try {
            res = mol.set_new_coords(useCoordGen);
        } catch (e) {
            exc = ` (${e})`;
        }
        if (!res) {
            console.error(`Failed to generate coordinates${useCoordGen ? ' with CoordGen' : ''}${exc}`);
            if (useCoordGen) {
                return this.setNewCoords(mol, false);
            }
        }
        return res;
    },

    /**
     * Returns the passed molecule as Uint8Array pickle
     * after:
     * - generating coordinates if it has none
     * - normalizing coordinates if normalize is true
     * - straightening the depiction if straighten is true
     * @param {JSMol} mol input molecule
     * @param {boolean} rebuild whether coordinates should
     * be generated even if already present
     * @param {boolean} useCoordGen whether CoordGen should be used
     * to generate 2D coordinates if the molecules has none
     * @param {boolean} normalize whether coordinates should be normalized
     * @param {number} canonicalize 0: do not canonicalize, 1: X axis, -1: Y axis
     * @param {boolean} straighten whether depiction should be straightened
     * @returns {object} object with three keys:
     * {
     *   pickle: Uint8Array; pickled molecule,
     *   hasOwnCoords: boolean; true if the molecule has its own coordinates
     *   rebuild: boolean; true if the molecule coordinates were rebuilt
     * }
     */
    getNormPickle(mol, {
        rebuild, useCoordGen, normalize, canonicalize, straighten
    }) {
        let pickle = '';
        const hasOwnCoords = (mol.has_coords() === 2);
        let hasCoords = hasOwnCoords;
        const scaleFac = (normalize ? -1.0 : 1.0);
        let wasRebuilt = rebuild || !hasOwnCoords;
        if (wasRebuilt || mol.normalize_depiction(canonicalize, scaleFac) < 0.0) {
            wasRebuilt = true;
            hasCoords = this.setNewCoords(mol, useCoordGen);
        }
        if (hasCoords) {
            if (wasRebuilt) {
                mol.normalize_depiction(canonicalize, scaleFac);
            }
            if (straighten) {
                const minimizeRotation = !wasRebuilt && !canonicalize;
                mol.straighten_depiction(minimizeRotation);
            }
            pickle = this.getPickleSafe(mol);
        }
        return { pickle };
    },

    get({
        rdkitModule,
        type,
        molDesc,
        scaffoldText,
        opts,
    }) {
        const optsLocal = opts || {};
        let {
            drawOpts, molOpts, scaffoldOpts, mcsParams
        } = optsLocal;
        drawOpts = drawOpts || {};
        molOpts = molOpts || {};
        scaffoldOpts = scaffoldOpts || {};
        mcsParams = mcsParams || {};
        const { referenceSmarts } = scaffoldOpts;
        delete scaffoldOpts.referenceSmarts;
        let rebuild = false;
        const pickle = new Uint8Array();
        let match = null;
        let svg = null;
        let mcsResult = null;
        let useMolBlockWedging = null;
        let hasOwnCoords = null;
        const res = {
            pickle,
            match,
            svg,
            mcsResult,
            rebuild,
            useMolBlockWedging,
            hasOwnCoords,
        };
        let mol;
        let useCoordGen = false;
        const behavior = {};
        const isBehaviorAuto = {};
        const setBehavior = (autoOptions) => {
            Object.keys(autoOptions).forEach((optName) => {
                switch (optsLocal[optName]) {
                case true:
                    isBehaviorAuto[optName] = false;
                    behavior[optName] = true;
                    break;
                case false:
                    isBehaviorAuto[optName] = false;
                    behavior[optName] = false;
                    break;
                default:
                    isBehaviorAuto[optName] = true;
                    behavior[optName] = autoOptions[optName];
                    break;
                }
            });
        };
        if (type) {
            if (typeof molDesc === 'string') {
                mol = (type !== JOB_TYPES.GENERATE_MCS
                    ? this.getMolSafe(rdkitModule, molDesc, molOpts)
                    : this.getMolListSafe(rdkitModule, molDesc, molOpts));
            } else {
                mol = (type !== JOB_TYPES.GENERATE_MCS
                    ? this.getMolFromUInt8Array(rdkitModule, molDesc)
                    : this.getMolListFromUInt8ArrayArray(rdkitModule, molDesc));
            }
        }
        if (mol) {
            try {
                const SANITIZE_FRAGS = { sanitizeFrags: false };
                const molDim = (typeof mol.has_coords === 'function' ? mol.has_coords() : 0);
                hasOwnCoords = (molDim === 2);
                rebuild = (!hasOwnCoords || optsLocal.RECOMPUTE2D);
                const abbreviate = optsLocal.ABBREVIATE;
                const { width, height } = drawOpts;
                const canonicalizeDir = (typeof width === 'number'
                    && typeof height === 'number' && width < height ? -1 : 1);
                setBehavior({
                    MOL_NORMALIZE: true,
                    MOL_CANONICALIZE: rebuild,
                    MOL_STRAIGHTEN: true,
                    USE_MOLBLOCK_WEDGING: !rebuild,
                });
                const normalize = behavior.MOL_NORMALIZE;
                let straighten = behavior.MOL_STRAIGHTEN;
                let canonicalize = (behavior.MOL_CANONICALIZE ? canonicalizeDir : 0);
                switch (type) {
                case JOB_TYPES.RDKIT_NATIVE_LAYOUT: {
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    break;
                }
                case JOB_TYPES.REBUILD_LAYOUT: {
                    rebuild = true;
                    useCoordGen = !optsLocal.FORCE_RDKIT;
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    break;
                }
                case JOB_TYPES.ALIGNED_LAYOUT: {
                    // if we need new coordinates, we use CoordGen to generate them
                    useCoordGen = !optsLocal.FORCE_RDKIT;
                    setBehavior({
                        SCAFFOLD_NORMALIZE: true,
                        SCAFFOLD_CANONICALIZE: false,
                        SCAFFOLD_STRAIGHTEN: true,
                    });
                    // rebuild is set to true if 1) mol does not have coordinates to start with
                    // 2) it fails coordinate normalization
                    if (normalize && mol.normalize_depiction(0) < 0.0) {
                        rebuild = true;
                    }
                    const canonicalizeScaffoldStored = behavior.SCAFFOLD_CANONICALIZE ? canonicalizeDir : 0;
                    match = null;
                    // if we do not recompute 2D coordinates, we only do a rigid-body rotation
                    const alignOnly = !rebuild;
                    // scaffoldText can be a pipe-separated string of SMILES
                    // or a $$$$-separated string of molblocks. Each scaffold can in turn
                    // be constituted by mutliple disconnected fragments.
                    const scaffoldTextArray = this.splitMolText(scaffoldText);
                    const queryArray = (typeof scaffoldOpts.query === 'boolean'
                        ? [scaffoldOpts.query] : [true, false]);
                    queryArray.every((query) => {
                        const scaffoldListArray = [];
                        scaffoldOpts.query = query;
                        scaffoldTextArray.every((maybeMultiScaffoldText) => {
                            const scaffold = this.getMolSafe(
                                rdkitModule, maybeMultiScaffoldText, scaffoldOpts
                            );
                            if (!scaffold) {
                                console.error('Failed to generate RDKit scaffold');
                                return true;
                            }
                            const { molList } = this.getFragsSafe(scaffold, SANITIZE_FRAGS) || {};
                            scaffold.delete();
                            if (molList) {
                                scaffoldListArray.push(molList);
                            }
                            return true;
                        });
                        scaffoldListArray.every((scaffoldList) => {
                            while (!match && !scaffoldList.at_end()) {
                                // scaffold is a single disconnected fragment
                                const scaffold = scaffoldList.next();
                                if (!scaffold) {
                                    continue;
                                }
                                let straightenScaffold = behavior.SCAFFOLD_STRAIGHTEN;
                                let normalizeScaffold = behavior.SCAFFOLD_NORMALIZE;
                                let canonicalizeScaffold = canonicalizeScaffoldStored;
                                let minimizeScaffoldRotation = !behavior.SCAFFOLD_CANONICALIZE;
                                let scaffoldHasCoords = scaffold.has_coords();
                                // if scaffold has no coordinates we normalize it, canonicalize it
                                // and straighten it fully unless user explicitly requested otherwise
                                if (!scaffoldHasCoords) {
                                    if (isBehaviorAuto.SCAFFOLD_NORMALIZE) {
                                        normalizeScaffold = true;
                                    }
                                    if (isBehaviorAuto.SCAFFOLD_CANONICALIZE) {
                                        canonicalizeScaffold = canonicalizeDir;
                                    }
                                    if (isBehaviorAuto.SCAFFOLD_STRAIGHTEN) {
                                        straightenScaffold = true;
                                        minimizeScaffoldRotation = false;
                                    }
                                    scaffoldHasCoords = this.setNewCoords(scaffold, true);
                                    if (!scaffoldHasCoords) {
                                        console.error('Failed to generate coordinates for scaffold - ignoring it');
                                    }
                                }
                                // if scaffold has coordinates but fails normalization we ignore it
                                if (scaffoldHasCoords && normalizeScaffold
                                    && scaffold.normalize_depiction(canonicalizeScaffold) < 0.0) {
                                    console.error('Scaffold has bad coordinates - ignoring it');
                                    scaffoldHasCoords = false;
                                }
                                // if scaffold has coordinates, we align mol to it through either
                                // a full rebuild (alignOnly=false) or a rigid-body rotation
                                // (alignOnly=true)
                                if (scaffoldHasCoords) {
                                    if (straightenScaffold) {
                                        scaffold.straighten_depiction(minimizeScaffoldRotation);
                                    }
                                    try {
                                        match = JSON.parse(mol.generate_aligned_coords(scaffold, JSON.stringify({
                                            useCoordGen,
                                            allowRGroups: true,
                                            acceptFailure: false,
                                            alignOnly,
                                            referenceSmarts,
                                        })) || null);
                                    } catch (e) {
                                        console.error(`Exception in generate_aligned_coords (${e})`);
                                    }
                                }
                                scaffold.delete();
                                // if there is a match and abbreviations were requested, the match
                                // needs to be adjusted/pruned accordingly
                                if (match && abbreviate) {
                                    try {
                                        const molCopy = rdkitModule.get_mol_copy(mol);
                                        const mapping = JSON.parse(molCopy.condense_abbreviations());
                                        // eslint-disable-next-line no-loop-func
                                        ['atoms', 'bonds'].forEach((k) => {
                                            const invMapping = Array(mapping[k].reduce(
                                                (prev, curr) => (curr > prev ? curr : prev), -1
                                            ) + 1).fill(-1);
                                            mapping[k].forEach((idx, pos) => {
                                                invMapping[idx] = pos;
                                            });
                                            match[k] = match[k].filter(
                                                (i) => invMapping[i] !== -1).map((j) => invMapping[j]
                                            );
                                        });
                                        molCopy.delete();
                                    } catch (e) {
                                        console.error(`Failed to apply abbreviations (${e})`);
                                        match = null;
                                    }
                                }
                            }
                            scaffoldList.delete();
                            // if there is a match we can quit the loop
                            return (match === null);
                        });
                        return (match === null);
                    });
                    const rebuildStored = rebuild;
                    // if there is a match, we only want to generate a pickle
                    if (match) {
                        rebuild = false;
                        straighten = false;
                        canonicalize = 0;
                    } else {
                        // if there is no match, we keep the original coordinates if any,
                        // unless user asked for a coordinate rebuild
                        // we only use CoordGen if RECOMPUTE2D is true and FORCE_RDKIT is false
                        useCoordGen = (optsLocal.RECOMPUTE2D && !optsLocal.FORCE_RDKIT);
                    }
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    rebuild = rebuildStored;
                    break;
                }
                case JOB_TYPES.GENERATE_SVG: {
                    if (abbreviate) {
                        mol.condense_abbreviations();
                    }
                    [0, 1].some(() => {
                        const drawOptsText = JSON.stringify(drawOpts);
                        try {
                            svg = mol.get_svg_with_highlights(drawOptsText);
                        } catch {
                            drawOpts.kekulize = false;
                        }
                        return svg;
                    });
                    break;
                }
                case JOB_TYPES.GENERATE_MCS: {
                    if (mol.size() > 1) {
                        try {
                            mcsResult = JSON.parse(rdkitModule.get_mcs_as_json(mol, JSON.stringify(mcsParams)));
                        } catch (e) {
                            console.error('Failed to generate MCS');
                        }
                    } else {
                        console.error('Need >=2 molecules to generate MCS');
                    }
                    break;
                }
                default: {
                    console.error(`Unknown message type ${type}`);
                    break;
                }
                }
                useMolBlockWedging = !rebuild && behavior.USE_MOLBLOCK_WEDGING;
                Object.assign(res, {
                    match, svg, mcsResult, hasOwnCoords, useMolBlockWedging
                });
            } finally {
                mol.delete();
            }
        }
        return res;
    },
};

export default Depiction;
