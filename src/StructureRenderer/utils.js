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

const Utils = {
    /**
     * Return the MinimalLib basename
     * @returns {string} MinimalLib basename
     */
    getMinimalLibBasename() {
        return 'RDKit_minimal';
    },

    /**
     * Replace &#10; with CR.
     * @param {string} s input string
     * @returns {string} string with &#10; replaced by CR
     */
    decodeNewline(s) {
        return s.replace(/&#10;/g, '\n');
    },

    /**
     * Replace CR with &#10;.
     * @param {string} s input string
     * @returns {string} string with CR replaced by &#10;
     */
    encodeNewline(s) {
        return s.replace(/\n/g, '&#10;');
    },

    /**
     * Return true if the passed string is a pkl_base64
     * @param {string} molText SMILES, CTAB or pkl_base64
     * @returns {boolean} true if pkl_base64
     */
    isBase64Pickle(molText) {
        return molText.startsWith('pkl_');
    },

    /**
     * Return true if molText is an MDL molblock.
     * @param {string} molText SMILES, CTAB or pkl_base64
     * @returns {boolean} true if MDL molblock
     */
    isMolBlock(molText) {
        return !this.isBase64Pickle(molText) && molText.includes('M  END');
    },

    /**
     * Return 'data-' prefixed attr.
     * @param {string} attr attr to be prefixed
     * @returns {string} 'data-' prefixed attr
     */
    dataAttr(attr) {
        return `data-${attr}`;
    },

    /**
     * Convert dashed prop name to camel-case prop name
     * @param {string} k dashed prop name
     * @returns {string} camel-case prop name
     */
    dashToCamelCase(k) {
        return k.replace(/-\w/g, (m) => m[1].toUpperCase());
    },

    /**
     * Convert camel-case prop name to dashed prop name
     * @param {string} k camel-case prop name
     * @returns {string} dashed prop name
     */
    camelCaseToDash(k) {
        return k.replace(/[A-Z]/g, (m) => `-${m[0].toLowerCase()}`);
    },

    /**
     * Convert uppercase, underscore-separated keys
     * to lowercase, dash-separated tags
     * @param {string} k uppercase, underscore-separated key
     * @returns {string} lowercase, dash-separated tag
     */
    keyToTag(k) {
        return k.toLowerCase().replace(/_/g, '-');
    },

    /**
     * Convert lowercase, dash-separated tags
     * to uppercase, underscore-separated keys
     * @param {string} t lowercase, dash-separated tag
     * @returns {string} uppercase, underscore-separated key
     */
    tagToKey(t) {
        return t.toUpperCase().replace(/-/g, '_');
    },

    /**
     * Converts a mol into its molblock representation.
     * It tries to get a kekulized molblock first
     * and fall back to aromatic if the former fails.
     * @param {JSMol} mol
     * @returns {string} molblock or '' in case of failure
     */
    getMolblockFromMol(mol, details) {
        let molblock = null;
        try {
            molblock = mol.get_molblock(details || '{}');
        } catch {
            // we handle this below
        }
        if (molblock === null) {
            try {
                molblock = mol.get_aromatic_form();
            } catch {
                console.error('Failed to convert mol to molblock');
                molblock = '';
            }
        }
        return molblock;
    },

    /**
     * Generate molecule from UInt8Array.
     * @param {UInt8Array} molPickle pickled molecule as UInt8Array
     * @returns {JSMol} molecule or null in case of failure
     */
    getMolFromUInt8Array(rdkitModule, pickle) {
        let mol;
        try {
            mol = rdkitModule.get_mol_from_uint8array(pickle);
        } catch (e) {
            console.error(`Failed to generate mol from pickle (${e})`);
        }
        return mol;
    },

    /**
     * Extract pickle from a pkl_base64 string
     * @param {string} molText pkl_base64 string
     * @returns {Uint8Array} Uint8Array pickle
     */
    extractBase64Pickle(molText) {
        return Uint8Array.from(
            atob(molText.substring(4)), (c) => c.charCodeAt(0));
    },

    /**
     * Returns the passed molecule as Uint8Array pickle.
     * @param {JSMol} mol input molecule
     * @returns {Uint8Array} pickled molecule
     */
    getPickleSafe(mol) {
        let pickle;
        try {
            pickle = mol.get_as_uint8array();
        } catch (e) {
            console.error(`Failed to get pickle (${e})`);
            pickle = new Uint8Array();
        }
        return pickle;
    },

    cssToText(keyValueDict, indentIn) {
        const _indentBy = (i) => Array(i + 1).fill('    ').join('');
        const indent = indentIn || 0;
        return Object.entries(keyValueDict).reduce(
            (prev, [cssKey, cssDict]) => prev + this.camelCaseToDash(cssKey) + ' {\n' +
            Object.entries(cssDict).reduce(
                (prev2, [k, v]) => prev2 + _indentBy(indent) +
                (typeof v === 'object' ?
                    this.cssToText({ [k]: v }, indent + 1) :
                    this.camelCaseToDash(k) + ': ' + v.toString() + ';\n'
                ), ''
            ) + _indentBy(indent - 1) + '}\n\n', ''
        ).trimEnd() + '\n';
    },

    /**
     * Get the center of an HTML element.
     * @param {HTMLElement} element
     * @returns {object} dictionary with the { x, y } center
     */
    getElementCenter(element) {
        const elementRect = element.getBoundingClientRect();
        return {
            x: Math.round(elementRect.left + 0.5 * elementRect.width),
            y: Math.round(elementRect.top + 0.5 * elementRect.height),
        };
    },

    /**
     * Get viewport width or height.
     * @param {string} attr either 'Width' or 'Height'
     * @returns {number} the viewport width or height
     */
    _getViewPortSizeAttr(attr) {
        const innerAttr = `inner${attr}`;
        const clientAttr = `client${attr}`;
        const innerSize = window[innerAttr];
        const clientSize = document.documentElement[clientAttr];
        return innerSize && clientSize ? Math.min(innerSize, clientSize) :
            innerSize || clientSize || document.body[clientAttr];
    },

    /**
     * Get viewport dimensions.
     * @returns {object} viewport dimensions
     */
    getViewPortRect() {
        return {
            left: 0,
            top: 0,
            width: this._getViewPortSizeAttr('Width'),
            height: this._getViewPortSizeAttr('Height'),
        };
    },

    /**
     * @param {string} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * The description may include multiple scaffolds, either separated by a pipe symbol
     * ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @returns {Array<string>} array of scaffold descriptions
     */
    splitScaffoldText(scaffoldText) {
        return scaffoldText.split(this.isMolBlock(scaffoldText) ? /\$\$\$\$\r?\n/ : '|');
    }
};

export default Utils;
