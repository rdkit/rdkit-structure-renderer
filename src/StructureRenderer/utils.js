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
const camelCaseToDash = k => k.replace(/[a-z][A-Z]/g, m => m[0] + '-' + m[1].toLowerCase());

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
}

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
};
