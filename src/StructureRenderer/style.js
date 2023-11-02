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

import { RDK_STR_RNR } from './constants';

const css = {
    [`.${RDK_STR_RNR}mol-container`]: {
        display: 'block',
        position: 'relative',
        backgroundColor: 'white',
        zIndex: 1,
    },
    '@-webkit-keyframes spin': {
        '0%': {
            WebkitTransform: 'rotate(0deg)',
        },
        '100%': {
            WebkitTransform: 'rotate(360deg)',
        },
    },
    '@keyframes spin': {
        '0%': {
            transform: 'rotate(0deg)',
        },
        '100%': {
            transform: 'rotate(360deg)',
        }
    },
    [`.${RDK_STR_RNR}spinner`]: {
        display: 'none',
        backgroundColor: 'white',
        position: 'absolute',
        width: '100%',
        height: '100%',
        zIndex: 11,
    },
    [`.${RDK_STR_RNR}spinner .whl`]: {
        display: 'block',
        margin: 'auto',
        borderStyle: 'solid',
        borderColor: '#f1f1f1',
        borderTopColor: '#3498db',
        borderRadius: '50%',
        WebkitAnimation: 'spin 1s linear infinite',
        animation: 'spin 1s linear infinite',
    },
    [`.${RDK_STR_RNR}mol-draw`]: {
        position: 'absolute',
    },
    [`.${RDK_STR_RNR}mol-container .button-container`]: {
        position: 'absolute',
        width: '100%',
        height: 0,
    },
    [`.${RDK_STR_RNR}mol-container .button`]: {
        position: 'absolute',
        top: '1px',
        opacity: 0,
        zIndex: 1,
        backgroundColor: 'white',
        border: 0,
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
        fontSize: '12px',
        lineHeight: 1,
        transitionDuration: '0.2s',
    },
    [`.${RDK_STR_RNR}tooltip`]: {
        position: 'absolute',
        padding: 0,
        margin: 0,
        zIndex: 2001,
    },
    [`.${RDK_STR_RNR}tooltip .container`]: {
        display: 'inline-block',
    },
    [`.${RDK_STR_RNR}tooltip .text`]: {
        backgroundColor: 'grey',
        color: 'white',
        textAlign: 'center',
        padding: '3px 5px 4px 5px',
        borderRadius: '5px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        whiteSpace: 'nowrap',
        fontWeight: 'normal',
        fontSize: '11px',
    },
    [`.${RDK_STR_RNR}tooltip .visible`]: {
        visibility: 'visible',
    },
    [`.${RDK_STR_RNR}tooltip .hidden`]: {
        visibility: 'hidden',
    },
    [`.${RDK_STR_RNR}mol-container .cog`]: {
        right: '1px',
    },
    [`.${RDK_STR_RNR}mol-container .copy`]: {
        left: '1px',
    },
    [`.${RDK_STR_RNR}button-icon`]: {
        color: 'black',
        fill: 'currentColor',
        display: 'inline-block',
        width: '10px',
        height: '10px',
    },
    [`.${RDK_STR_RNR}button-icon:hover`]: {
        color: '#A9A9A9',
    },
    [`.${RDK_STR_RNR}button-icon img`]: {
        verticalAlign: 'baseline',
    },
    [`.${RDK_STR_RNR}mol-container:hover .button`]: {
        opacity: 1,
    },
    [`.${RDK_STR_RNR}mol-container .always-visible`]: {
        opacity: 1,
    },
    [`.${RDK_STR_RNR}dialog`]: {
        display: 'block',
        position: 'absolute',
        background: 'white',
        border: '2px solid black',
        width: 'min-content',
        height: 'min-content',
        zIndex: 2001,
        color: 'black',
        fontSize: '12px',
        fontFamily: 'Arial, Helvetica, sans-serif',
        whiteSpace: 'nowrap',
        fontWeight: 'normal',
    },
    [`.${RDK_STR_RNR}title`]: {
        display: 'inline-block',
        margin: '5px 8px 0px 8px',
        fontWeight: 'bold',
        lineHeight: 1.3,
    },
    [`.${RDK_STR_RNR}checkbox`]: {
        color: 'black',
        display: 'block',
        position: 'relative',
        margin: '3px 0px 0px 8px',
        padding: '0px 0px 0px 20px',
        cursor: 'pointer',
        fontWeight: 'normal',
        lineHeight: 1.3,
    },
    [`.${RDK_STR_RNR}dropdown`]: {
        display: 'block',
        position: 'relative',
        margin: '0px 0px 0px 8px',
    },
    [`.${RDK_STR_RNR}dropdown select`]: {
        color: 'black',
        background: 'white',
        appearance: 'none',
        padding: '3px 10px 0px 20px',
        border: '0px',
        outline: '0px',
        cursor: 'pointer',
        fontSize: '12px',
        fontFamily: 'Arial, Helvetica, sans-serif',
    },
    [`.${RDK_STR_RNR}dropdown .chevron`]: {
        color: 'black',
        position: 'absolute',
        height: '6px',
        width: '6px',
        margin: '2px 0px 0px 4px',
        cursor: 'pointer',
        backgroundColor: 'white',
        border: 'solid black',
        borderWidth: '0 2px 2px 0',
        boxSizing: 'content-box',
        transform: 'rotate(45deg)',
        pointerEvents: 'none',
    },
    [`.${RDK_STR_RNR}checkbox[disabled]`]: {
        color: 'lightgray',
    },
    [`.${RDK_STR_RNR}checkbox input`]: {
        margin: 0,
        visibility: 'hidden',
        cursor: 'pointer',
    },
    [`.${RDK_STR_RNR}checkbox .box`]: {
        position: 'absolute',
        top: '1px',
        left: '0px',
        height: '9px',
        width: '9px',
        backgroundColor: 'white',
        border: '2px solid black',
        boxSizing: 'content-box',
    },
    [`.${RDK_STR_RNR}checkbox[disabled] .box`]: {
        border: '2px solid lightgray',
    },
    [`.${RDK_STR_RNR}checkbox:hover:not([disabled]) input ~ .box`]: {
        backgroundColor: 'lightgray',
    },
    [`.${RDK_STR_RNR}checkbox:hover:not([disabled]) input:checked ~ .box`]: {
        backgroundColor: 'blue',
    },
    [`.${RDK_STR_RNR}checkbox input:checked ~ .box`]: {
        backgroundColor: 'blue',
        border: 'solid blue',
        borderWidth: '2px',
        transitionDuration: '0.2s',
    },
    [`.${RDK_STR_RNR}checkbox input ~ .mark`]: {
        display: 'none',
    },
    [`.${RDK_STR_RNR}checkbox input:checked ~ .mark`]: {
        display: 'block',
        position: 'absolute',
        left: '4px',
        top: '1px',
        width: '3px',
        height: '8px',
        border: 'solid white',
        padding: 0,
        backgroundColor: 'transparent',
        borderWidth: '0 2px 2px 0',
        transform: 'rotate(45deg)',
        boxSizing: 'content-box',
    },
    [`.${RDK_STR_RNR}formats`]: {
        display: 'block',
        position: 'relative',
        margin: '3px 8px 3px 8px',
        padding: 0,
        cursor: 'default',
        fontSize: '12px',
    },
    [`.${RDK_STR_RNR}formats .label`]: {
        display: 'inline-block',
        boxSizing: 'border-box',
        cursor: 'pointer',
        fontWeight: 'bold',
        backgroundColor: 'white',
        margin: 0,
        lineHeight: 1.3,
    },
    [`.${RDK_STR_RNR}formats .chevron-label`]: {
        padding: '3px 0px 0px 20px',
    },
    [`.${RDK_STR_RNR}formats input[type=checkbox]`]: {
        visibility: 'hidden',
        cursor: 'pointer',
    },
    [`.${RDK_STR_RNR}formats input ~ .chevron`]: {
        position: 'absolute',
        height: '6px',
        width: '6px',
        cursor: 'pointer',
        backgroundColor: 'white',
        border: 'solid black',
        borderWidth: '0 2px 2px 0',
        boxSizing: 'content-box',
    },
    [`.${RDK_STR_RNR}formats input ~ .chevron:hover`]: {
        borderColor: 'darkgray',
        transitionDuration: '0.2s',
    },
    [`.${RDK_STR_RNR}formats input ~ .collapsed`]: {
        display: 'block',
        top: '7px',
        left: '2px',
        transform: 'rotate(-45deg)',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .collapsed`]: {
        display: 'none',
    },
    [`.${RDK_STR_RNR}formats input ~ .expanded`]: {
        display: 'none',
        top: '5px',
        left: '2px',
        transform: 'rotate(45deg)',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .expanded`]: {
        display: 'block',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .spinner`]: {
        display: 'block',
        position: 'relative',
        zIndex: 11,
    },
    [`.${RDK_STR_RNR}formats input ~ .spinner`]: {
        display: 'none',
    },
    [`.${RDK_STR_RNR}formats input ~ .label`]: {
        display: 'none',
    },
    [`.${RDK_STR_RNR}formats input ~ .table`]: {
        display: 'none',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .label`]: {
        display: 'inline-block',
        margin: '8px 0 3px 0',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .table`]: {
        display: 'table',
        margin: '8px 0px 0px 0px',
        borderCollapse: 'collapse',
        width: '100%',
        lineHeight: 1.3,
    },
    [`.${RDK_STR_RNR}formats .scale`]: {
        display: 'inline-block',
        borderWidth: '2px',
        borderColor: 'black',
        width: '3em',
        visibility: 'visible',
        cursor: 'auto',
    },
    [`.${RDK_STR_RNR}formats .fmtcell`]: {
        border: 'none',
        padding: '0 0.5em 0 0',
        verticalAlign: 'middle',
    },
    [`.${RDK_STR_RNR}formats .scalecell`]: {
        border: 'none',
        padding: '0 0 4px 0',
        textAlign: 'right',
        verticalAlign: 'middle',
    },
    [`.${RDK_STR_RNR}formats .copy`]: {
        display: 'inline-block',
        border: 'none',
        outline: 'none',
        backgroundColor: 'transparent',
        padding: '0px 4px 2px 4px',
        cursor: 'pointer',
    },
    [`.${RDK_STR_RNR}formats .disabled-icon`]: {
        color: '#D3D3D3',
    },
    [`.${RDK_STR_RNR}formats .disabled-label`]: {
        color: 'lightgray',
    },
    [`.${RDK_STR_RNR}formats input ~ .box`]: {
        display: 'none',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .box`]: {
        display: 'block',
        padding: '4px',
        backgroundColor: 'white',
        border: 'solid black',
        borderWidth: '2px',
        resize: 'vertical',
        scrollbarWidth: 'thin',
        cursor: 'auto',
        fontFamily: 'monospace',
        lineHeight: 'normal',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .box::-webkit-scrollbar`]: {
        width: '0.8em',
        height: '0.8em',
        background: '#f1f1f1',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .box::-webkit-scrollbar-thumb`]: {
        background: '#c1c1c1',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .smilesinchi`]: {
        minHeight: '2em',
        maxHeight: '4em',
        height: '2em',
        overflowY: 'scroll',
    },
    [`.${RDK_STR_RNR}formats input:checked ~ .molblock`]: {
        minHeight: '6em',
        maxHeight: '12em',
        height: '6em',
        overflow: 'scroll',
    },
};

export default css;
