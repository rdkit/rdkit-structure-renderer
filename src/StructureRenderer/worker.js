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

const main = (rdkitReady, dispatcherId) => {
    const FALLBACK_OPS = ['kekulize', 'sanitize'];
    const decodeNewline = molblock => molblock.replace(/&#10;/g, '\n');

    onmessage = ({ data }) => rdkitReady.then(rdkitModule => {
        /**
         * Generate molecule from either SMILES or CTAB.
         * @param {string} molText either SMILES or CTAB
         * @returns {JSMol} molecule or null in case of failure
         */
        const getMolSafe = (molText) => {
            const molTextDecoded = decodeNewline(molText);
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
                    mol = rdkitModule.get_mol(molTextDecoded, JSON.stringify(opts));
                } catch(e) {
                    exc = ` (${e})`;
                }
                if (!mol?.is_valid()) {
                    if (mol) {
                        mol.delete();
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

        const {
            type,
            molText,
            scaffoldText,
            molPickle,
            opts,
            wPort,
        } = data;
        if (!wPort) {
            return;
        }
        let pickle = new Uint8Array();
        let match = null;
        let svg = null;
        let res = {
            pickle,
            match,
            svg,
        };
        let mol;
        let exc = '';
        let useCoordGen = false;
        if (type) {
            if (molText) {
                mol = getMolSafe(molText);
            } else if (molPickle) {
                mol = rdkitModule.get_mol_from_uint8array(molPickle);
            }
        }
        if (mol) {
            if (mol.is_valid()) {
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
                        let scaffold = getMolSafe(scaffoldText);
                        if (!scaffold) {
                            console.error(`Failed to generate RDKit scaffold${exc}`);
                        } else if (!scaffold.has_coords()) {
                            let res = setNewCoords(scaffold, true);
                            if (!res) {
                                res = setNewCoords(scaffold, false);
                            }
                            if (!res) {
                                scaffold.delete();
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
                                let molCopy;
                                if (abbreviate) {
                                    molCopy = rdkitModule.get_mol_copy(mol);
                                    try {
                                        molCopy.generate_aligned_coords(scaffold, true, true, false);
                                        mol.condense_abbreviations();
                                    } catch {
                                        match = null;
                                    }
                                }
                                if (match) {
                                    try {
                                        match = mol.generate_aligned_coords(scaffold, true, true, false);
                                        match = JSON.parse(match);
                                    } catch {
                                        match = null;
                                    }
                                }
                                if (molCopy) {
                                    if (!match) {
                                        setNewCoords(molCopy, false);
                                    }
                                    mol.delete();
                                    mol = molCopy;
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
            }
            mol.delete();
        }
        wPort.postMessage(res);
        wPort.close();
    });
    console.log(`worker ${dispatcherId} ready`);
};

export default main;
