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

const css =
`.rdk-str-rnr-mol-container {
    display: block;
    position: relative;
    background-color: white;
    z-index: 1;
}

@-webkit-keyframes spin {
    0% { -webkit-transform: rotate(0deg); }
    100% { -webkit-transform: rotate(360deg); }
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.rdk-str-rnr-spinner {
    display: none;
    background-color: white;
    position: absolute;
    width: 100%;
    height: 100%;
    z-index: 11;
}

.rdk-str-rnr-spinner .whl {
    display: block;
    margin: auto;
    border-style: solid;
    border-color: #f1f1f1;
    border-top-color: #3498db;
    border-radius: 50%;
    -webkit-animation: spin 1s linear infinite;
    animation: spin 1s linear infinite;
}

.rdk-str-rnr-mol-draw {
    position: absolute;
}

.rdk-str-rnr-mol-container .button {
    position: absolute;
    top: 1px;
    opacity: 0;
    z-index: 2;
    background-color: white;
    border: 0;
    cursor: pointer;
    outline: none;
    padding: 0;
    font-size: 12px;
    line-height: 1;
    transition-duration: 0.2s;
} 

.rdk-str-rnr-mol-container .copy {
    left: 1px;
} 

.rdk-str-rnr-mol-container .cog {
    right: 1px;
} 

.rdk-str-rnr-button-icon {
    width: 10px;
    height: 10px;
} 

.rdk-str-rnr-button-icon img {
    vertical-align: baseline;
}

/* turn SVG dark gray (#A9A9A9) upon hovering, see https://codepen.io/sosuke/pen/Pjoqqp */
.rdk-str-rnr-button-icon:hover {
    filter: invert(62%) sepia(0%) saturate(35%) hue-rotate(144deg) brightness(107%) contrast(98%);
    transition-duration: 0.2s;
}

.rdk-str-rnr-mol-container:hover .button {
    opacity: 1;
}

.rdk-str-rnr-mol-container .always-visible {
    opacity: 1;
} 

.rdk-str-rnr-dialog {
    display: block;
    position: absolute;
    background: white;
    border: 2px solid black;
    width: min-content;
    height: min-content;
    z-index: 2001;
    color: black;
    font-size: 12px;
    font-family: Arial, Helvetica, sans-serif;
    white-space: nowrap;
    font-weight: normal;
}

.rdk-str-rnr-title {
    display: inline-block;
    margin: 5px 8px 0px 8px;
    font-weight: bold;
    line-height: 1.3;
}

.rdk-str-rnr-checkbox {
    color: black;
    display: block;
    position: relative;
    margin: 3px 0px 0px 8px;
    padding: 0px 0px 0px 20px;
    cursor: pointer;
    font-weight: normal;
    line-height: 1.3;
}

.rdk-str-rnr-checkbox[disabled] {
    color: lightgray;
}

.rdk-str-rnr-checkbox input {
    margin: 0;
    visibility: hidden;
    cursor: pointer;
}

.rdk-str-rnr-checkbox .box {
    position: absolute;
    top: 1px;
    left: 0px;
    height: 9px;
    width: 9px;
    background-color: white;
    border: 2px solid black;
    box-sizing: content-box;
}

.rdk-str-rnr-checkbox[disabled] .box {
    border: 2px solid lightgray;
}

.rdk-str-rnr-checkbox:hover:not([disabled]) input ~ .box {
    background-color: lightgray;
}

.rdk-str-rnr-checkbox:hover:not([disabled]) input:checked ~ .box {
    background-color: blue;
}

.rdk-str-rnr-checkbox input:checked ~ .box {
    background-color: blue;
    border: solid blue;
    border-width: 2px;
    transition-duration: 0.2s;
}

.rdk-str-rnr-checkbox input ~ .mark {
    display: none;
}

.rdk-str-rnr-checkbox input:checked ~ .mark {
    display: block;
    position: absolute;
    left: 4px;
    top: 1px;
    width: 3px;
    height: 8px;
    border: solid white;
    padding: 0;
    background-color: transparent;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    box-sizing: content-box;
}

.rdk-str-rnr-formats {
    display: block;
    position: relative;
    margin: 3px 8px 3px 8px;
    padding: 0;
    cursor: default;
    font-size: 12px;
}

.rdk-str-rnr-formats .label {
    display: inline-block;
    box-sizing: border-box;
    cursor: pointer;
    font-weight: bold;
    background-color: white;
    margin: 0;
    line-height: 1.3;
}

.rdk-str-rnr-formats .chevron-label {
    padding: 3px 0px 0px 20px;
}

.rdk-str-rnr-formats input[type=checkbox] {
    visibility: hidden;
    cursor: pointer;
}

.rdk-str-rnr-formats input ~ .chevron {
    position: absolute;
    height: 6px;
    width: 6px;
    cursor: pointer;
    background-color: white;
    border: solid black;
    border-width: 0 2px 2px 0;
    box-sizing: content-box;
}

.rdk-str-rnr-formats input ~ .chevron:hover {
    border-color: darkgray;
    transition-duration: 0.2s;
}

.rdk-str-rnr-formats input ~ .collapsed {
    display: block;
    top: 7px;
    left: 2px;
    transform: rotate(-45deg);
}

.rdk-str-rnr-formats input:checked ~ .collapsed {
    display: none;
}

.rdk-str-rnr-formats input ~ .expanded {
    display: none;
    top: 5px;
    left: 2px;
    transform: rotate(45deg);
}

.rdk-str-rnr-formats input:checked ~ .expanded {
    display: block;
}

.rdk-str-rnr-formats input:checked ~ .spinner {
    display: block;
    position: relative;
    z-index: 11;
}

.rdk-str-rnr-formats input ~ .spinner {
    display: none;
}

.rdk-str-rnr-formats input ~ .label {
    display: none;
}

.rdk-str-rnr-formats input ~ .table {
    display: none;
}

.rdk-str-rnr-formats input:checked ~ .label {
    display: inline-block;
    margin: 8px 0 3px 0;
}

.rdk-str-rnr-formats input:checked ~ .table {
    display: table;
    margin: 8px 0px 0px 0px;
    border-collapse: collapse;
    width: 100%;
    line-height: 1.3;
}

.rdk-str-rnr-formats .scale {
    display: inline-block;
    border-width: 2px;
    border-color: black;
    width: 3em;
    visibility: visible;
    cursor: auto;
}

.rdk-str-rnr-formats .fmtcell {
    border: none;
    padding: 0 0.5em 0 0;
    vertical-align: middle;
}

.rdk-str-rnr-formats .scalecell {
    border: none;
    padding: 0 0 4px 0;
    text-align: right;
    vertical-align: middle;
}

.rdk-str-rnr-formats .copy {
    display: inline-block;
    border: none;
    outline: none;
    background-color: transparent;
    padding: 0px 4px 2px 4px;
    cursor: pointer;
}

/* turn SVG light gray (#D3D3D3) when disabled, see https://codepen.io/sosuke/pen/Pjoqqp */
.rdk-str-rnr-formats .disabled-icon {
    filter: invert(96%) sepia(0%) saturate(0%) hue-rotate(182deg) brightness(92%) contrast(86%);
}

.rdk-str-rnr-formats .disabled-label {
    color: lightgray;
}

.rdk-str-rnr-formats input ~ .box {
    display: none;
}

.rdk-str-rnr-formats input:checked ~ .box {
    display: block;
    padding: 4px;
    background-color: white;
    border: solid black;
    border-width: 2px;
    resize: vertical;
    scrollbar-width: thin;
    cursor: auto;
    font-family: monospace;
    line-height: normal;
}

.rdk-str-rnr-formats input:checked ~ .box::-webkit-scrollbar {
    width: 0.8em;
    height: 0.8em;
    background: #f1f1f1;
}

.rdk-str-rnr-formats input:checked ~ .box::-webkit-scrollbar-thumb {
    background: #c1c1c1;
}

.rdk-str-rnr-formats input:checked ~ .smilesinchi {
    min-height: 2em;
    max-height: 4em;
    height: 2em;
    overflow-y: scroll;
}

.rdk-str-rnr-formats input:checked ~ .molblock {
    min-height: 6em;
    max-height: 12em;
    height: 6em;
    overflow: scroll;
}`;

export default css;
