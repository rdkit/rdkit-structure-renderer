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

import { RDK_STR_RNR } from './constants.js';

const html =
`<div class="${RDK_STR_RNR}dialog">
    <label class="${RDK_STR_RNR}title">Structure Renderer Options</label>
    <div class="${RDK_STR_RNR}formats">
        <label class="label chevron-label" id="${RDK_STR_RNR}formats-label">Formats</label>
        <input type="checkbox" id="${RDK_STR_RNR}formats-input"/>
        <span class="chevron collapsed" id="${RDK_STR_RNR}formats-collapsed"></span>
        <span class="chevron expanded" id="${RDK_STR_RNR}formats-expanded"></span>
        <div></div>
        <label class="label">SMILES
            <button type="button" class="copy" id="${RDK_STR_RNR}copy-smiles"></button>
        </label>
        <textarea class="box smilesinchi" id="${RDK_STR_RNR}content-smiles" readonly="true" wrap="hard">&nbsp;</textarea>
        <div></div>
        <label class="label">Molblock
            <button type="button" class="copy" id="${RDK_STR_RNR}copy-molblock"></button>
        </label>
        <textarea class="box molblock" id="${RDK_STR_RNR}content-molblock" readonly="true" wrap="off">&nbsp;</textarea>
        <div></div>
        <label class="label">InChI
            <button type="button" class="copy" id="${RDK_STR_RNR}copy-inchi"></button>
        </label>
        <textarea class="box smilesinchi" id="${RDK_STR_RNR}content-inchi" readonly="true" wrap="hard">&nbsp;</textarea>
        <div></div>
        <table class="table">
            <tr>
                <td class="fmtcell"><label class="label">PNG
                    <button type="button" class="copy" id="${RDK_STR_RNR}copy-png"></button>
                </label></td>
                <td class="fmtcell"><label class="label">SVG
                    <button type="button" class="copy" id="${RDK_STR_RNR}copy-svg"></button>
                </label></td>
                <td class="scalecell"><span class="label">&times;</span>
                    <input class="scale" type="number" id="${RDK_STR_RNR}scalefac" value="1" min="1" max="9" step="1"/></td>
            </tr>
        </table>
    </div>
</div>`;

export default html;
