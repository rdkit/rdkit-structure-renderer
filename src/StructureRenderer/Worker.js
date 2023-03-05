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

import {
    extractBase64Pickle,
    getMolFromUInt8Array,
    getPickleSafe,
    isBase64Pickle,
    isMolBlock,
    splitScaffoldText,
} from './utils';

const Depiction = {
    extractBase64Pickle,
    getMolFromUInt8Array,
    getPickleSafe,
    isBase64Pickle,
    isMolBlock,
    splitScaffoldText,

    /**
     * Generate molecule from SMILES, CTAB or pkl_base64.
     * @param {object}
     * @param {string} molText SMILES, CTAB or pkl_base64
     * @returns {JSMol} molecule or null in case of failure
     */
    getMolSafe(rdkitModule, molText, getMolOpts) {
        if (this.isBase64Pickle(molText)) {
            const molPickle = this.extractBase64Pickle(molText);
            return this.getMolFromUInt8Array(rdkitModule, molPickle);
        }
        const FALLBACK_OPS = ['kekulize', 'sanitize'];
        // this is called recursively until success
        // or until FALLBACK_OPS are available
        const _getMolSafe = (opIdxIn) => {
            let opIdx = opIdxIn;
            let exc = '';
            let mol = null;
            const opts = getMolOpts || {};
            let op;
            if (typeof opIdx === 'number') {
                op = FALLBACK_OPS[opIdx];
                opts[op] = false;
            } else {
                opIdx = -1;
            }
            try {
                mol = rdkitModule.get_mol(molText, JSON.stringify(opts));
            } catch (e) {
                exc = ` (${e})`;
            }
            if (!mol?.is_valid()) {
                if (mol) {
                    mol.delete();
                    mol = null;
                }
                while (++opIdx < FALLBACK_OPS.length && opts[FALLBACK_OPS[opIdx]]);
                if (opIdx < FALLBACK_OPS.length) {
                    return _getMolSafe(opIdx);
                }
                console.error(`Failed to generate RDKit mol${exc}`);
            } else if (op) {
                console.error(`Failed to ${op} RDKit mol${exc}`);
            }
            return mol;
        };
        return _getMolSafe();
    },

    /**
     * Generate JSMolIterator from a JSMol potentially
     * containing multiple disconnected fragments.
     * @param {JSMol} mol RDKit JSMol
     * @returns {JSMolIterator} molecule iterator or null in case of failure
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
            if (typeof opIdx === 'number') {
                op = FALLBACK_OPS[opIdx];
                opts[op] = false;
            } else {
                opIdx = -1;
            }
            try {
                res = mol.get_frags(JSON.stringify(opts));
            } catch (e) {
                exc = ` (${e})`;
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
     * @returns {object} object with two keys:
     * {
     *   pickle: Uint8Array; pickled molecule,
     *   rebuild: boolean; true if the molecule coordinates were rebuilt
     * }
     */
    getNormPickle(mol, {
        rebuild, useCoordGen, normalize, canonicalize, straighten
    }) {
        let pickle = '';
        let hasCoords = mol.has_coords();
        const scaleFac = (normalize ? -1.0 : 1.0);
        let wasRebuilt = rebuild || !hasCoords;
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
        return { pickle, wasRebuilt };
    },

    get({
        rdkitModule,
        type,
        molText,
        scaffoldText,
        molPickle,
        opts,
    }) {
        const optsLocal = opts || {};
        let rebuild = false;
        const pickle = new Uint8Array();
        let match = null;
        let svg = null;
        let useMolBlockWedging = null;
        const res = {
            pickle,
            match,
            svg,
            rebuild,
            useMolBlockWedging,
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
            if (molText) {
                mol = this.getMolSafe(rdkitModule, molText);
            } else if (molPickle) {
                mol = this.getMolFromUInt8Array(rdkitModule, molPickle);
            }
        }
        if (mol) {
            try {
                rebuild = !mol.has_coords();
                const abbreviate = optsLocal.ABBREVIATE;
                let { drawOpts } = optsLocal;
                drawOpts = drawOpts || {};
                const { width, height } = drawOpts;
                const canonicalizeDir = (typeof width === 'number'
                    && typeof height === 'number' && width < height ? -1 : 1);
                setBehavior({
                    MOL_NORMALIZE: true,
                    MOL_CANONICALIZE: rebuild || optsLocal.RECOMPUTE2D,
                    MOL_STRAIGHTEN: true,
                    USE_MOLBLOCK_WEDGING: !(rebuild || optsLocal.RECOMPUTE2D),
                });
                const normalize = behavior.MOL_NORMALIZE;
                let straighten = behavior.MOL_STRAIGHTEN;
                let canonicalize = (behavior.MOL_CANONICALIZE ? canonicalizeDir : 0);
                useMolBlockWedging = !(rebuild || optsLocal.RECOMPUTE2D) && behavior.USE_MOLBLOCK_WEDGING;
                switch (type) {
                case 'c': {
                    rebuild = true;
                    useCoordGen = true;
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    break;
                }
                case 'a': {
                    // if we need new coordinates, we use CoordGen to generate them
                    useCoordGen = optsLocal.RECOMPUTE2D;
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
                    const alignOnly = !optsLocal.RECOMPUTE2D;
                    // scaffoldText can be a pipe-separated string of SMILES
                    // or a $$$$-separated string of molblocks. Each scaffold can in turn
                    // be constituted by mutliple disconnected fragments.
                    const scaffoldTextArray = this.splitScaffoldText(scaffoldText);
                    const scaffoldIteratorArray = [];
                    scaffoldTextArray.every((maybeMultiScaffoldText) => {
                        let scaffold = this.getMolSafe(rdkitModule, maybeMultiScaffoldText, {
                            removeHs: false,
                            mergeQueryHs: true,
                        });
                        if (scaffold && !scaffold.is_valid()) {
                            scaffold.delete();
                            scaffold = null;
                        }
                        if (!scaffold) {
                            console.error('Failed to generate RDKit scaffold');
                            return true;
                        }
                        const { molIterator } = this.getFragsSafe(scaffold);
                        scaffold.delete();
                        if (molIterator) {
                            scaffoldIteratorArray.push(molIterator);
                        }
                        return true;
                    });
                    scaffoldIteratorArray.every((scaffoldIterator) => {
                        while (!match && !scaffoldIterator.at_end()) {
                            // scaffold is a single disconnected fragment
                            const scaffold = scaffoldIterator.next();
                            if (!scaffold) {
                                break;
                            }
                            if (!scaffold.is_valid()) {
                                scaffold.delete();
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
                            // a full CoordGen rebuild (alignOnly=false) or a rigid-body rotation
                            // (alignOnly=true)
                            if (scaffoldHasCoords) {
                                if (straightenScaffold) {
                                    scaffold.straighten_depiction(minimizeScaffoldRotation);
                                }
                                try {
                                    match = JSON.parse(mol.generate_aligned_coords(scaffold, JSON.stringify({
                                        useCoordGen: true,
                                        allowRGroups: true,
                                        acceptFailure: false,
                                        alignOnly,
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
                        scaffoldIterator.delete();
                        // if there is a match we can quit the loop
                        return (match === null);
                    });
                    const rebuildStored = rebuild;
                    // if there is a match, we only want to generate a pickle
                    if (match) {
                        rebuild = false;
                        straighten = false;
                        canonicalize = 0;
                    } else {
                        // if there is no match, we keep the original coordinates
                        // unless user asked for a coordinate rebuild, in which
                        // case we run a CoordGen rebuild with no scaffold
                        useMolBlockWedging = false;
                        if (opts.RECOMPUTE2D) {
                            rebuild = true;
                        }
                    }
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    res.wasRebuilt |= rebuildStored;
                    break;
                }
                case 'r': {
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    break;
                }
                case 's': {
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
                default: {
                    console.error(`Unknown message type ${type}`);
                    break;
                }
                }
                Object.assign(res, { match, svg, useMolBlockWedging });
            } finally {
                mol.delete();
            }
        }
        return res;
    },
};

export default Depiction;
