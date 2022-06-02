// Copyright (c) 2022, Novartis Institutes for BioMedical Research
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

/**
 * Replace &#10; with CR.
 * @param {string} s input string
 * @returns {string} string with &#10; replaced by CR
 */
const decodeNewline = s => s.replace(/&#10;/g, '\n');

/**
 * Replace CR with &#10;.
 * @param {string} s input string
 * @returns {string} string with CR replaced by &#10;
 */
const encodeNewline = s => s.replace(/\n/g, '&#10;');

/**
 * Return true if molblock is an MDL molblock.
 * @returns {string} true if MDL molblock
 */
const isMolBlock = molText => molText.includes('M  END');

/**
 * Return 'data-' prefixed attr.
 * @param {string} attr attr to be prefixed
 * @returns {string} 'data-' prefixed attr
 */
const dataAttr = (attr) => `data-${attr}`;

/**
 * Convert dashed prop name to camel-case prop name
 * @param {string} k dashed prop name
 * @returns {string} camel-case prop name
 */
const dashToCamelCase = k => k.replace(/-\w/g, m => m[1].toUpperCase());

/**
 * Convert camel-case prop name to dashed prop name
 * @param {string} k camel-case prop name
 * @returns {string} dashed prop name
 */
const camelCaseToDash = k => k.replace(/[A-Z]/g, m => '-' + m[0].toLowerCase());

/**
 * Convert uppercase, underscore-separated keys
 * to lowercase, dash-separated tags
 * @param {string} k uppercase, underscore-separated key
 * @returns {string} lowercase, dash-separated tag
 */
 const keyToTag = k => k.toLowerCase().replace(/_/g, '-');

/**
 * Convert lowercase, dash-separated tags
 * to uppercase, underscore-separated keys
 * @param {string} t lowercase, dash-separated tag
 * @returns {string} uppercase, underscore-separated key
 */
 const tagToKey = t => t.toUpperCase().replace(/-/g, '_');

/**
 * Converts a mol into its molblock representation.
 * It tries to get a kekulized molblock first
 * and fall back to aromatic if the former fails.
 * @param {JSMol} mol
 * @returns {string} molblock or '' in case of failure
 */
const getMolblockFromMol = mol => {
    let molblock = null;
    try {
        molblock = mol.get_molblock();
    } catch {
        // we handle this below
    }
    if (molblock === null) {
        try {
            molblock = mol.get_aromatic_form();
        } catch {
            console.error("Failed to convert mol to molblock");
            molblock = '';
        }
    }
    return molblock;
};

/**
 * Generate molecule from either SMILES or CTAB.
 * @param {string} molText either SMILES or CTAB
 * @returns {JSMol} molecule or null in case of failure
 */
const getMolSafe = (rdkitModule, molText) => {
    const FALLBACK_OPS = ['kekulize', 'sanitize'];
    // this is called recursively until success
    // or until FALLBACK_OPS are available
    const _getMolSafe = opIdx => {
        let exc = '';
        let mol = null;
        let opts = {};
        let op;
        if (typeof opIdx === 'number') {
            op = FALLBACK_OPS[opIdx];
            opts[op] = false;
        } else {
            opIdx = -1;
        }
        try {
            mol = rdkitModule.get_mol(molText, JSON.stringify(opts));
        } catch(e) {
            exc = ` (${e})`;
        }
        if (!mol?.is_valid()) {
            if (mol) {
                mol.delete();
                mol = null;
            }
            if (++opIdx < FALLBACK_OPS.length) {
                return _getMolSafe(opIdx);
            } else {
                console.error(`Failed to generate RDKit mol${exc}`);
            }
        } else if (op) {
            console.error(`Failed to ${op} RDKit mol${exc}`);
        }
        return mol;
    }
    return _getMolSafe();
};

/**
    * Returns the passed molecule as Uint8Array pickle.
    * @param {JSMol} mol input molecule
    * @returns pickled molecule as Uint8Array
    */
const getPickleSafe = (mol) => {
    let pickle;
    try {
        pickle = mol.get_as_uint8array();
    } catch(e) {
        console.error(`Failed to get pickle (${e})`);
        pickle = new Uint8Array();
    }
    return pickle;
};

/**
    * Returns the passed molecule as Uint8Array pickle
    * after:
    * - generating coordinates if it has none
    * - normalizing coordinates if normalize is true
    * - straightening the depiction if straighten is true
    * @param {JSMol} mol input molecule
    * @param {boolean} useCoordGen whether CoordGen should be used
    * to generate 2D coordinates if the molecules has none
    * @param {boolean} normalize whether coordinates should be normalized
    * @param {number} canonicalize 0: do not canonicalize, 1: X axis, -1: Y axis
    * @param {boolean} straighten whether depiction should be straightened
    * @returns pickled molecule as Uint8Array
    */
const getNormPickle = (mol, { useCoordGen, normalize, canonicalize, straighten }) => {
    let pickle = '';
    if (typeof canonicalize === 'undefined') {
        canonicalize = 1;
    }
    let hasCoords = mol.has_coords();
    if (!hasCoords || useCoordGen) {
        hasCoords = setNewCoords(mol, useCoordGen);
    }
    if (hasCoords) {
        if (normalize) {
            mol.normalize_depiction(canonicalize);
        }
        if (straighten) {
            mol.straighten_depiction();
        }
        pickle = getPickleSafe(mol);
    }
    return pickle;
}

/**
    * Add coordinates to the passed molecule.
    * @param {JSMol} mol input molecule
    * @param {boolean} useCoordGen whether new coordinates
    * should be generated with CoordGen
    * @returns {boolean} true if success, false if failure
    */
const setNewCoords = (mol, useCoordGen) => {
    let res = false;
    let exc = '';
    try {
        res = mol.set_new_coords(useCoordGen)
    } catch(e) {
        exc = ` (${e})`;
    }
    if (!res) {
        console.error(`Failed to generate coordinates${useCoordGen ? ' with CoordGen' : ''}${exc}`);
    }
    return res;
};

const cssToText = (keyValueDict, indent) => {
    const _indentBy = (indent) => Array(indent + 1).fill('    ').join('');
    indent = indent || 0;
    return Object.entries(keyValueDict).reduce(
        (prev, [cssKey, cssDict]) => prev + camelCaseToDash(cssKey) + ' {\n' +
        Object.entries(cssDict).reduce(
            (prev, [k, v]) => prev + _indentBy(indent) +
            (typeof v === 'object' ?
                cssToText({[k]: v}, indent + 1) :
                camelCaseToDash(k) + ': ' + v.toString()  + ';\n'
            ), ''
        ) + _indentBy(indent - 1) + '}\n\n', ''
    ).trimEnd() + '\n';
};

const getDepiction = function({
    rdkitModule,
    type,
    molText,
    scaffoldText,
    molPickle,
    opts,
}) {
    let pickle = new Uint8Array();
    let match = null;
    let svg = null;
    let res = {
        pickle,
        match,
        svg,
    };
    let mol;
    let useCoordGen = false;
    if (type) {
        if (molText) {
            mol = getMolSafe(rdkitModule, molText);
        } else if (molPickle) {
            try {
                mol = rdkitModule.get_mol_from_uint8array(molPickle);
                if (mol && !mol.is_valid()) {
                    mol.delete();
                    mol = null;
                }
            } catch(e) {
                console.error(`Failed to generate mol from pickle (${e})`);
            }
        }
    }
    if (mol) {
        try {
            const abbreviate = opts.ABBREVIATE;
            const normalize = !opts.NO_MOL_NORMALIZE;
            let straighten = !opts.NO_MOL_STRAIGHTEN;
            const normalizeScaffold = !opts.NO_SCAFFOLD_NORMALIZE;
            const straightenScaffold = !opts.NO_SCAFFOLD_STRAIGHTEN;
            switch (type) {
                case 'c': {
                    useCoordGen = true;
                    pickle = getNormPickle(mol, { useCoordGen, normalize, straighten });
                    break;
                }
                case 'a': {
                    match = {};
                    let scaffold = getMolSafe(rdkitModule, scaffoldText);
                    if (!scaffold) {
                        console.error(`Failed to generate RDKit scaffold`);
                    } else if (!scaffold.has_coords()) {
                        let res = setNewCoords(scaffold, true);
                        if (!res) {
                            res = setNewCoords(scaffold, false);
                        }
                        if (!res) {
                            scaffold.delete();
                            scaffold = null;
                            match = null;
                        }
                    }
                    if (scaffold) {
                        if (scaffold.is_valid()) {
                            if (normalizeScaffold) {
                                scaffold.normalize_depiction();
                            }
                            if (straightenScaffold) {
                                scaffold.straighten_depiction();
                            }
                            try {
                                match = JSON.parse(mol.generate_aligned_coords(scaffold, true, true, false));
                            } catch {
                                match = null;
                            }
                            if (match && abbreviate) {
                                try {
                                    const molCopy = rdkitModule.get_mol_copy(mol);
                                    const mapping = JSON.parse(molCopy.condense_abbreviations());
                                    ["atoms", "bonds"].forEach(k => {
                                        const invMapping = Array(mapping[k].reduce(
                                            (prev, curr) => curr > prev ? curr : prev, -1) + 1).fill(-1);
                                        mapping[k].forEach((idx, pos) => invMapping[idx] = pos);
                                        match[k] = match[k].filter(i => invMapping[i] !== -1).map(i => invMapping[i]);
                                    })
                                    molCopy.delete();
                                } catch(e) {
                                    console.error(`Failed to apply abbreviations (${e})`);
                                    match = null;
                                }
                            }
                        }
                        scaffold.delete();
                    }
                    let canonicalize = 1;
                    if (match) {
                        straighten = false;
                        canonicalize = 0;
                    }
                    pickle = getNormPickle(mol, { useCoordGen, normalize, canonicalize, straighten });
                    break;
                }
                case 'r': {
                    pickle = getNormPickle(mol, { useCoordGen, normalize, straighten });
                    break;
                }
                case 's': {
                    if (abbreviate) {
                        mol.condense_abbreviations();
                    }
                    const drawOptsText = JSON.stringify(opts.drawOpts || {});
                    svg = mol.get_svg_with_highlights(drawOptsText);
                    break;
                }
                default: {
                    console.error(`Unknown message type ${type}`);
                    break;
                }
            }
            Object.assign(res, { pickle, match, svg });
        } finally {
            mol.delete();
        }
    }
    return res;
};

export {
    decodeNewline,
    encodeNewline,
    isMolBlock,
    dataAttr,
    dashToCamelCase,
    camelCaseToDash,
    keyToTag,
    tagToKey,
    getMolblockFromMol,
    getMolSafe,
    getPickleSafe,
    getNormPickle,
    setNewCoords,
    getDepiction,
    cssToText,
};
