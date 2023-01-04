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
            let molIterator = null;
            const opts = getFragsOpts || {};
            let op;
            if (typeof opIdx === 'number') {
                op = FALLBACK_OPS[opIdx];
                opts[op] = false;
            } else {
                opIdx = -1;
            }
            try {
                molIterator = mol.get_frags(JSON.stringify(opts));
            } catch (e) {
                exc = ` (${e})`;
            }
            if (!molIterator) {
                if (++opIdx < FALLBACK_OPS.length) {
                    return _getFragsSafe(opIdx);
                }
                console.error(`Failed to get frags from RDKit mol${exc}`);
            } else if (op) {
                console.error(`Failed to run ${op}`);
            }
            return molIterator;
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
        rebuildIn, useCoordGen, normalize, canonicalize, straighten
    }) {
        let pickle = '';
        let hasCoords = mol.has_coords();
        const scaleFac = (normalize ? -1.0 : 1.0);
        let rebuild = rebuildIn || !hasCoords;
        if (rebuild || mol.normalize_depiction(canonicalize, scaleFac) < 0.0) {
            rebuild = true;
            hasCoords = this.setNewCoords(mol, useCoordGen);
        }
        if (hasCoords) {
            if (rebuild) {
                mol.normalize_depiction(canonicalize, scaleFac);
            }
            if (straighten) {
                const minimizeRotation = !rebuild && !canonicalize;
                mol.straighten_depiction(minimizeRotation);
            }
            pickle = this.getPickleSafe(mol);
        }
        return { pickle, rebuild };
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
        const res = {
            pickle,
            match,
            svg,
            rebuild,
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
                    ALIGN_REBUILD: optsLocal.RECOMPUTE2D,
                    USE_MOLBLOCK_WEDGING: !(rebuild || optsLocal.RECOMPUTE2D),
                });
                const normalize = behavior.MOL_NORMALIZE;
                let straighten = behavior.MOL_STRAIGHTEN;
                let canonicalize = (behavior.MOL_CANONICALIZE ? canonicalizeDir : 0);
                let alignRebuild = behavior.ALIGN_REBUILD;
                let useMolblockWedging = behavior.USE_MOLBLOCK_WEDGING;
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
                    useCoordGen = optsLocal.RECOMPUTE2D;
                    setBehavior({
                        SCAFFOLD_NORMALIZE: true,
                        SCAFFOLD_CANONICALIZE: false,
                        SCAFFOLD_STRAIGHTEN: true,
                    });
                    if (normalize && mol.normalize_depiction(0) < 0.0) {
                        rebuild = true;
                        if (isBehaviorAuto.ALIGN_REBUILD) {
                            alignRebuild = true;
                        }
                    }
                    const canonicalizeScaffoldStored = behavior.SCAFFOLD_CANONICALIZE ? canonicalizeDir : 0;
                    match = null;
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
                        if (molIterator) {
                            scaffoldIteratorArray.push(molIterator);
                        }
                        return true;
                    });
                    scaffoldIteratorArray.every((scaffoldIterator) => {
                        while (!match && !scaffoldIterator.at_end()) {
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
                            if (!scaffold.has_coords()) {
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
                                const hasCoords = this.setNewCoords(scaffold, true);
                                if (!hasCoords) {
                                    scaffold.delete();
                                    continue;
                                }
                            }
                            if (normalizeScaffold
                                && scaffold.normalize_depiction(canonicalizeScaffold) < 0.0) {
                                console.error('Scaffold has bad coordinates - ignoring it');
                                scaffold.delete();
                                continue;
                            }
                            if (straightenScaffold) {
                                scaffold.straighten_depiction(minimizeScaffoldRotation);
                            }
                            try {
                                match = JSON.parse(mol.generate_aligned_coords(scaffold, JSON.stringify({
                                    useCoordGen: true,
                                    allowRGroups: true,
                                    acceptFailure: false,
                                    alignOnly: !alignRebuild,
                                })) || null);
                            } catch (e) {
                                console.error(`Exception in generate_aligned_coords (${e})`);
                            }
                            if (match) {
                                if (abbreviate) {
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
                            scaffold.delete();
                        }
                        scaffoldIterator.delete();
                        return (match === null);
                    });
                    const rebuildStored = rebuild;
                    if (match) {
                        useMolblockWedging = false;
                        rebuild = false;
                        straighten = false;
                        canonicalize = 0;
                    } else if (optsLocal.RECOMPUTE2D) {
                        useMolblockWedging = false;
                        rebuild = true;
                    }
                    Object.assign(res, this.getNormPickle(mol, {
                        rebuild, useCoordGen, normalize, canonicalize, straighten
                    }));
                    if (rebuildStored) {
                        res.rebuild = rebuildStored;
                    }
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
                    if (useMolblockWedging) {
                        Object.assign(drawOpts, {
                            useMolBlockWedging: true,
                            wedgeBonds: false,
                            addChiralHs: false,
                        });
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
                Object.assign(res, { match, svg });
            } finally {
                mol.delete();
            }
        }
        return res;
    },
};

export default Depiction;
