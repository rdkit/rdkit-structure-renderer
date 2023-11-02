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

const DEFAULT_DRAW_OPTS = {
    backgroundColour: [1, 1, 1, 1]
};

const DEFAULT_MOL_OPTS = {};

const DEFAULT_SCAFFOLD_OPTS = {
    removeHs: false,
    mergeQueryHs: true,
};

const DEFAULT_IMG_OPTS = {
    scaleFac: 1,
    copyImgScaleFac: 2,
    width: 300,
    height: 200,
};

const NATIVE_CANVAS_RESOLUTION = 96;

const RDK_STR_RNR = 'rdk-str-rnr-';

const DIVID_SEPARATOR = '___';

const DIV_ATTRS = [
    'WIDTH',
    'HEIGHT',
    'MOL',
    'SCAFFOLD',
    'DRAW_OPTS',
    'MOL_OPTS',
    'SCAFFOLD_OPTS',
    'PARENT_NODE',
    'BEFORE_NODE',
    'SCROLLING_NODE',
    'HIDE_COPY',
    'HIDE_COG',
    'USE_SVG'
];

const BUTTON_TYPES = [
    {
        type: 'copy',
        tooltip: 'copy as PNG and molblock',
    }, {
        type: 'cog',
        tooltip: 'settings',
    }
];

const OPT_TYPES = {
    BOOL: 1,
    MULTIBOOL: 2,
};

const LAYOUT_TYPES = {
    ORIGINAL: 1,
    RDKIT: 2,
    COORDGEN: 3,
};

const USER_OPTS = {
    LAYOUT: {
        items: [{
            value: LAYOUT_TYPES.ORIGINAL,
            label: 'Original layout',
            action: {
                RECOMPUTE2D: false,
                FORCE_RDKIT: false,
            },
        }, {
            value: LAYOUT_TYPES.RDKIT,
            label: 'RDKit layout',
            action: {
                RECOMPUTE2D: true,
                FORCE_RDKIT: true,
            },
        }, {
            value: LAYOUT_TYPES.COORDGEN,
            label: 'CoordGen layout',
            action: {
                RECOMPUTE2D: true,
                FORCE_RDKIT: false,
            },
        }],
        type: OPT_TYPES.MULTIBOOL,
    },
    SCAFFOLD_ALIGN: {
        label: 'Align to scaffold',
        type: OPT_TYPES.BOOL,
    },
    SCAFFOLD_HIGHLIGHT: {
        label: 'Highlight scaffold',
        type: OPT_TYPES.BOOL,
    },
    ABBREVIATE: {
        label: 'Abbreviate groups',
        type: OPT_TYPES.BOOL,
    },
    ATOM_IDX: {
        label: 'Add atom indices',
        type: OPT_TYPES.BOOL,
    },
    RECOMPUTE2D: {
        label: null,
        type: OPT_TYPES.BOOL,
    },
    FORCE_RDKIT: {
        label: null,
        type: OPT_TYPES.BOOL,
    },
    MOL_NORMALIZE: {},
    MOL_STRAIGHTEN: {},
    MOL_CANONICALIZE: {},
    SCAFFOLD_NORMALIZE: {},
    SCAFFOLD_STRAIGHTEN: {},
    SCAFFOLD_CANONICALIZE: {},
    USE_MOLBLOCK_WEDGING: {},
};

const NO_MATCH = '_noMatch';
const HAS_OWN_COORDS = '_hasCoords';
const WAS_REBUILT = '_rebuilt';

const CLIPBOARD_OPTS = {
    name: 'clipboard-write',
    allowWithoutGesture: false,
};

const WHL_OPTS = {
    SCALE: 0.3,
    WIDTH: 6,
    TIMEOUT: 500,
};

const JOB_TYPES = {
    RDKIT_NATIVE_LAYOUT: 1,
    REBUILD_LAYOUT: 2,
    ALIGNED_LAYOUT: 3,
    GENERATE_SVG: 4,
    GENERATE_MCS: 5,
};

export {
    DEFAULT_DRAW_OPTS,
    DEFAULT_MOL_OPTS,
    DEFAULT_SCAFFOLD_OPTS,
    DEFAULT_IMG_OPTS,
    NATIVE_CANVAS_RESOLUTION,
    RDK_STR_RNR,
    DIVID_SEPARATOR,
    DIV_ATTRS,
    BUTTON_TYPES,
    USER_OPTS,
    OPT_TYPES,
    LAYOUT_TYPES,
    NO_MATCH,
    HAS_OWN_COORDS,
    WAS_REBUILT,
    CLIPBOARD_OPTS,
    WHL_OPTS,
    JOB_TYPES,
};
