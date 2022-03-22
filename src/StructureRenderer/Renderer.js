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

import defaultRendererCss from './style.js';
import defaultDialogHtml from './dialog.js';
import defaultIcons from './icons.js';
import Scheduler from './Scheduler.js';
import SettingsDialog from './SettingsDialog.js';
import {
    decodeNewline,
    dataAttr,
    dashToCamelCase,
    keyToTag,
    getMolblockFromMol
} from './utils.js';
import {
    DEFAULT_DRAW_OPTS,
    DIVID_PREFIX,
    DIVID_SEPARATOR,
    DIV_ATTRS,
    BUTTON_TYPES,
    USER_OPTS,
    NO_MATCH,
    CLIPBOARD_OPTS,
    WHL_OPTS,
} from './constants.js';


var _RDKitModule;

const Renderer = {
     /**
     * Override to change, currently hardware concurrency minus 2.
     * @returns {number} Hardware concurrency
     */
    getHardwareConcurrency: () => Math.max((navigator.hardwareConcurrency || 1) - 2, 1),

    /**
     * Override to change, currently capped to 8.
     * @returns {number} Maximum allowed concurrency independently of hardware
     */
    getMaxConcurrency: () => 8,

    /**
     * Override for custom CSS.
     * @returns {string} CSS style used by Renderer
     */
    getRendererCss: () => defaultRendererCss,

    /**
     * Override for custom HTML.
     * @returns {string} HTML used by SettingsDialog
     */
    getDialogHtml: () => defaultDialogHtml,

    /**
     * Override to get an array of Dispatchers.
     * Currently returns null, which means we spawn our own.
     * @returns {Array<Dispatcher>} array of Dispatchers
     */
    getDispatchers: () => null,

     /**
      * Override to use an existing RDKitModule.
      * @returns {Promise} promise that resolves to RDKitModule
      */
    getRDKitModule: async function() {
         await this.init();
         return _RDKitModule;
     },

    /**
     * Override to use custom default drawing options.
     * @returns {object} default drawing options
     */
    getDefaultDrawOpts: () => DEFAULT_DRAW_OPTS,

    /**
     * Return default drawing option k.
     * @returns {object} default drawing option k
     */
    getDefaultDrawOpt: function(k) {
        return this.getDefaultDrawOpts()[k];
    },

    /**
     * Override to change clipboard options.
     * @returns {object} clipboard options
     */
    getClipboardOpts: () => CLIPBOARD_OPTS,

    /**
     * Override to change spinning wheel settings.
     * @returns {object} spinning wheel settings
     */
    getWhlOpts: () => WHL_OPTS,

    /**
     * Override to change the name of the class used
     * to style the mol container.
     * @returns {object} clipboard options
     */
    getContainerClassName: function() {
        return this.getDivIdPrefix() + 'container';
    },

    /**
     * Override to change how the complete divId is generated.
     * @returns {string} the complete divId
     */
    getDivIdTag: function(divId, uniqueId) {
        if (typeof uniqueId !== 'undefined' && uniqueId !== null) {
            divId += `${this.getDivIdSeparator()}${uniqueId}`;
        }
        return divId;
    },

    /**
     * Override to use a different divId prefix.
     * @returns {string} the divId prefix
     */
    getDivIdPrefix: () => DIVID_PREFIX,

    /**
     * Override to use a different separator in divId.
     * The divId may consist of one or two parts, separated by
     * a separator. If the separator is present, only the divId
     * portion on the rhs of the separator is used to retrieve
     * cached settings from userOptCache. This mechanism allows
     * to tie a set of userOpts to multiple divIds, having a
     * different lhs but the same rhs.
     * @returns {string} the divId prefix
     */
    getDivIdSeparator: () => DIVID_SEPARATOR,

    /**
     * Override to use a different set of divId tags.
     * @returns {object} a dictionary mapping tag keys to tag names
     */
    getDivAttrs: function() {
        if (!this._divAttrs) {
            this._divAttrs = Object.fromEntries(DIV_ATTRS.map(k => [k, keyToTag(k)]));
        }
        return this._divAttrs;
    },

    /**
     * Override to use different button names.
     * @returns {Array<string>} an array of button names
     */
    getButtonTypes: () => BUTTON_TYPES,

    /**
     * Override to customize the settings dialog.
     * @returns {SettingsDialog} SettingsDialog instance
     */
    createSettingsDialog: function() {
        return new SettingsDialog(this);
    },

    /**
     * Override to use different user opts.
     * @returns {object} a dictionary relating tag keys to a { tag, text }
     * dictionary where tag is the HTML tag name and text is the label
     * displayed in the SettingsDialog. If text is null, the entry is not
     * displayed in the SettingsDialog, but can still be set programmatically
     * through the HTML tag
     */
    getUserOpts: function() {
         if (!this._userOpts) {
             this._userOpts = Object.fromEntries(
                 Object.entries(USER_OPTS).map(([k, text]) =>
                     [k, { tag: keyToTag(k), text }]));
         }
         return this._userOpts;
     },

    /**
     * Get boolean user options for a given div.
     * @param {Element} div
     * @returns {object} dictionary mapping each userOpt key to its boolean value
     */
    getUserOptsForDiv: function(div) {
        return Object.fromEntries(Object.entries(
            this.getUserOpts()).map(([k, { tag }]) => [k, this.getBoolOpt(div, tag)]));
    },

    /**
     * Number of spawned WebWorkers.
     * @returns {number} concurrency
     */
    getConcurrency: function() {
        if (!this._concurrency) {
            this._concurrency = Math.min(
                this.getHardwareConcurrency(), this.getMaxConcurrency());
        }
        return this._concurrency;
    },

    /**
     * @returns {boolean} true if RDKitModule is available
     */
    isRDKitReady: function() {
        if (!this._isRDKitReady) {
            this._isRDKitReady = _RDKitModule && typeof _RDKitModule.version === 'function';
        }
        return this._isRDKitReady;
    },

    /**
     * Return div containing the SVG icon for buttonType.
     * @param {string} buttonType 'copy' or 'cog'
     * @returns {Element} HTML div containing the SVG icon
     */
    getButtonIcon: buttonType => {
        const div = document.createElement('div');
        div.className = 'rdk-str-rnr-button-icon';
        div.innerHTML = defaultIcons[buttonType];
        return div;
    },

    /**
     * @returns {string} the URL where MinimalLib JS and WASM live
     */
    getMinimalLibPath: function() {
        if (typeof this._minimalLibPath === 'undefined') {
            throw Error('ERROR: getMinimalLibPath() called before init()');
        }
        return this._minimalLibPath;
    },

    /**
     * Return user opts that can be checked by the user.
     * @returns {Array<object>} an array of { tag, text } dictionaries
     */
    getCheckableUserOpts: function() {
        if (!this._checkableUserOpts) {
            this._checkableUserOpts = Object.values(
                this.getUserOpts()).filter(({ text }) => text !== null);
        }
        return this._checkableUserOpts;
    },

    /**
     * Called to initialize the RDKitModule used by UI and load CSS
     * into the current HTML document. If the URL of the MinimalLib
     * JS loader, MinimalLib will be loaded from there, otherwise
     * it will be loaded from the default location.
     * @param {string} minimalLibPath optional URL containing RDKit_minimal.js
     * @returns {Promise} Promise that resolves to the RDKit module
     * once the latter is loaded and initialized
     */
    init: function(minimalLibPath) {
        if (this.isRDKitReady()) {
            return Promise.resolve(this);
        }
        if (!this._minimalLibJs) {
            const _loadRendererCss = () => {
                const rendererCss = this.getRendererCss();
                const style = document.createElement('style');
                const styleText = document.createTextNode(rendererCss);
                style.setAttribute('type', 'text/css');
                style.appendChild(styleText);
                document.head.appendChild(style);
            };
            if (typeof minimalLibPath !== 'string') {
                minimalLibPath = document.currentScript?.src || '';
            }
            this._minimalLibPath = minimalLibPath.substring(0, minimalLibPath.lastIndexOf('/'));
            this._minimalLibJs = `${this._minimalLibPath}/RDKit_minimal.js`;
            _loadRendererCss();
        }
        // if the RDKit module has already been initialzed, return it
        const _loadRDKitModule = (resolve) => {
            const TIMEOUT = 50;
            if (typeof _RDKitModule === 'undefined') {
                _RDKitModule = null;
                const rdkitLoaderScript = document.createElement('script');
                rdkitLoaderScript.src = this._minimalLibJs;
                rdkitLoaderScript.async = true;
                rdkitLoaderScript.onload = () => _loadRDKitModule(resolve);
                document.head.appendChild(rdkitLoaderScript);
            }
            if (window.initRDKitModule || _RDKitModule) {
                let res = this;
                if (!_RDKitModule) {
                    if (typeof initRDKitModule !== 'function') {
                        throw Error('_loadRDKitModule: initRDKitModule is not a function');
                    }
                    _RDKitModule = window.initRDKitModule();
                    // create the Scheduler (which in turn may spawn WebWorkers)
                    (async () => this.scheduler())();
                    res = (async () => {
                        _RDKitModule = await _RDKitModule;
                        if (!this.isRDKitReady()) {
                            throw Error(`_loadRDKitModule: Failed to bootstrap ${this._minimalLibJs}`);
                        }
                        window.initRDKitModule = undefined;
                        // uncomment to have the RDKitModule available in console for debugging
                        // window.RDKitModule = _RDKitModule;
                        // uncomment to have the Renderer available in console for debugging
                        // window.RDKitStructureRenderer = this;
                        console.log('version: ' + _RDKitModule.version());
                        return this;
                    })();
                }
                resolve(res);
            } else {
                // MinimalLib has not finished loading yet, try again after TIMEOUT ms
                setTimeout(() => resolve(new Promise(_loadRDKitModule)), TIMEOUT);
            }
        };
        return new Promise(_loadRDKitModule);
    },

    /**
     * Get the divId from a div, removing, if present, DIVID_PREFIX
     * @param {Element} div molDiv
     * @returns {string} divId
     */
    getDivId: function(div) {
        if (!this._divIdRe) {
            this._divIdRe = new RegExp(`^(${this.getDivIdPrefix()})?(.*)$`);
        }
        return div.id.match(this._divIdRe)[2];
    },

    /**
     * Get the cacheKey from a div or divId, removing, if present,
     * DIVID_PREFIX and,if present, the uniqueId before the ___ separator
     * @param {Element|string} div molDiv
     * @returns {string} cacheKey
     */
    getCacheKey: function(div) {
        if (!this._cachedKeyRe) {
            this._cachedKeyRe = new RegExp(
                `^(${this.getDivIdPrefix()})?(.*${this.getDivIdSeparator()})?(.*)$`);
        }
        return (typeof div === 'object' ? div.id : div).match(this._cachedKeyRe)[3];
    },

    /**
     * Return an array of optional HTML tags whose key in DIV_ATTRS
     * end with _NODE which specify the parent node the SettingsDialog div
     * should become a child of and the node after which the SettingsDialog
     * div should be inserted
     * @returns {Array<String>} HTML tag array
     */
    relatedNodes: function() {
        if (!this._relatedNodes) {
            this._relatedNodes = Object.keys(this.getDivAttrs()).filter(v =>
                v.endsWith('_NODE')).map(k => this.getDivAttrs()[k]);
        }
        return this._relatedNodes;
    },

    /**
     * currentDivs accessor.
     * @returns {Map} Map of currently mounted div attributes
     */
    currentDivs: function() {
        if (!this._currentDivs) {
            this._currentDivs = new Map();
        }
        return this._currentDivs;
    },

    /**
     * Return div corresponding to divId.
     * @param {string} divId identifier for a div
     * @returns {Element} div corresponding to divId
     */
    getMolDiv: function(divId) {
        return document.querySelector(`div[id=${this.getDivIdPrefix()}${divId}]`);
    },

    /**
     * Return array of currently mounted mol divs.
     * @returns {Array<Element>} array of currently mounted mol divs
     */
    getMolDivArray: function() {
        return document.querySelectorAll(`div[id^=${this.getDivIdPrefix()}]`)
    },

    /**
     * Return button Element with specified type for div.
     * @param {Element} div
     * @param {Element} type either 'cog' or 'copy'
     * @returns {Element} button Element
     */
    getButton: (div, type) => div.getElementsByClassName(`button ${type}`)[0],

    /**
     * Return canvas or SVG div Element for div.
     * @param {Element} div
     * @returns {Element} canvas or SVG div Element
     */
    getMolDraw: (div) => div.querySelector('[name=mol-draw]'),

    /**
     * Set the enabled/disabled status for button
     * @param {Element} button
     * @param {boolean} shouldEnable enabled/disabled status
     * @param {boolean} useGreyOut if true, grey/ungrey out button
     * and associated label (if any)
     */
    setButtonEnabled: (button, shouldEnable, useGreyOut) => {
        const modifyClass = (elem, item, disable) => {
            const re = new RegExp(`( ${item})*$`);
            elem.className = elem.className.replace(re, disable ? ` ${item}` : '');
        };
        const disable = !shouldEnable;
        button.disabled = disable;
        if (useGreyOut) {
            modifyClass(button, 'disabled-icon', disable);
            const label = button.parentNode;
            if (label && label.nodeName === 'LABEL') {
                modifyClass(label, 'disabled-label', disable);
            }
        }
    },

    /**
     * Set the enabled/disabled status for existing buttons in a given div
     * @param {Element} div
     * @param {boolean} shouldEnable enabled/disabled status
     * @param {boolean} useGreyOut if true, grey/ungrey out button
     * and associated label (if any)
     */
    setButtonsEnabled: function(div, shouldEnable, useGreyOut) {
        this.getButtonTypes().forEach(buttonType => {
            const button = this.getButton(div, buttonType);
            button && this.setButtonEnabled(button, shouldEnable, useGreyOut);
        });
    },

    /**
     * Print an error message to the console if the copy
     * to clipboard operation failed.
     * @param {string} failedTo operation that failed
     */
    logClipboardError: (failedTo) =>
        console.error(`Unable to copy to clipboard - Failed to ${failedTo}`),

    /**
     * Return true if clipboard can be accessed.
     * @returns {boolean} true if clipboard can be accessed
     */
    canAccessClipboard: async function() {
        let permissionStatus;
        try {
            permissionStatus = await navigator.permissions.query(this.getClipboardOpts());
        } catch {
            this.logClipboardError('query permissions');
            return false;
        }
        if (permissionStatus.state === 'denied') {
            this.logClipboardError('obtain permission');
            return false;
        }
        return true;
    },

    /**
     * Scheduler creator and accessor.
     * @returns {object} Scheduler
     */
    scheduler: function() {
        if (!this._scheduler) {
            const cleanupFunc = (divId) => {
                const currentDiv = this.currentDivs().get(divId);
                if (currentDiv) {
                    delete currentDiv.childQueue;
                }
            };
            this._scheduler = new Scheduler({
                minimalLibPath: this.getMinimalLibPath(),
                concurrency: this.getConcurrency(),
                dispatchers: this.getDispatchers(),
                cleanupFunc
            });
        }
        return this._scheduler;
    },

    /**
     * Submit msg to mainQueue or directly to a childQueue,
     * in case msg was emitted by a SettingsDialog.
     * @param {object} msg message to be submitted
     * @returns {object} a Promise that will resolve to the
     * result when the job is completed, or to null is the job
     * is aborted before being submitted
     */
    submit: function(msg) {
        const currentDiv = this.currentDivs().get(msg.divId) || {};
        // if this message involves the same divId as the one the
        // the SettingsDialog is currently open on and a ChildQueue
        // was assigned, submit directly to the ChildQueue, otherwise
        // submit to the MainQueue
        return (msg.divId === this.settings?.currentDivId && currentDiv.childQueue ?
            currentDiv.childQueue.submit(msg) : this.scheduler().mainQueue.submit(msg));
    },

    /**
     * Request mol pickle for a given divId.
     * @param {string} divId id of the div le molecule belongs to
     * @param {string} molText molecule description (SMILES or molblock)
     * @param {string} scaffoldText scaffold description (SMILES or molblock)
     * @param {object} opts rendering options
     * @returns {string} a Promise that will resolve to an object containing
     * the mol pickle when the job is completed, or to null
     * if the job is aborted before being submitted
     */
    requestMolPickle: function(divId, molText, scaffoldText, opts) {
        let type = 'r';
        if (scaffoldText) {
            type = 'a';
        } else if (opts.RECOMPUTE2D) {
            type = 'c';
        }
        return this.submit({
            divId,
            type,
            molText,
            scaffoldText,
            opts,
        });
    },

    /**
     * Request SVG for a given divId.
     * @param {string} divId id of the div le molecule belongs to
     * @param {UInt8Array} molPickle molecule description as pickle
     * @param {object} opts rendering options
     * @returns {string} a Promise that will resolve to an object containing
     * the SVG when the job is completed, or to null
     * if the job is aborted before being submitted
     */
     requestSvg: function(divId, molPickle, opts) {
        const type = 's';
        return this.submit({
            divId,
            type,
            molPickle,
            opts,
        });
    },

    /**
     * Request molecule description for a given div.
     * @param {Element} div
     * @returns {string} molecule description (SMILES or molblock)
     */
    getMol: function(div) {
        const attr = dataAttr(this.getDivAttrs().MOL);
        return decodeNewline(div.getAttribute(attr) || '');
    },

    /**
     * Increment the number of references to divId by one
     * @param {string} divId
     */
    incRef: function(divId) {
        const key = this.getCacheKey(divId);
        const cachedEntry = this.userOptCache[key] || {
            refCount: 0,
        };
        ++cachedEntry.refCount;
        this.userOptCache[key] = cachedEntry;
    },

    /**
     * Decrement the number of references to divId by one
     * When the number drops to zero, cached coordinates are deleted.
     * @param {string} divId
     */
    decRef: function(divId) {
        const key = this.getCacheKey(divId);
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry && !--cachedEntry.refCount) {
            delete cachedEntry.currentMol;
        }
    },

    /**
     * Get current molecule coordinates and match for a given div.
     * @param {Element|string} div div or divId
     * @returns {object} molecule coordinates and match
     */
    getCurrentMol: function(div) {
        const key = this.getCacheKey(div);
        return this.userOptCache[key]?.currentMol || {};
    },

    /**
     * Clear cached coordinates and match asocated to a given div.
     * @param {Element|string} div div or divId
     */
    clearCurrentMol: function(div) {
        const key = this.getCacheKey(div);
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            cachedEntry.currentMol = null;
        }
    },

    /**
     * Set current molecule coordinates and match for a given div.
     * @param {Element|string} div div or divId
     * @param {Uint8Array} pickle molecule pickle
     * @param {string} match scaffold match
     */
    setCurrentMol: function(div, pickle, match) {
        const key = this.getCacheKey(div);
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            cachedEntry.currentMol = {
                pickle,
                match,
            };
        }
    },

    /**
     * Get scaffold description for a given div.
     * @param {Element} div
     * @returns {string} scaffold description (SMILES or molblock)
     */
    getScaffold: function(div) {
        const attr = dataAttr(this.getDivAttrs().SCAFFOLD);
        return div.getAttribute(attr) || '';
    },

    /**
     * Get 2D coords as pickle for a given div.
     * @param {Element} div
     * @param {boolean} align true if aligned coords were requested
     * @returns {object} object containing pickle with
     * 2D coords (and indices matching the scaffold)
     */
     getMolCoords: async function(div, userOpts) {
        let scaffoldText;
        if (userOpts.SCAFFOLD_ALIGN || userOpts.SCAFFOLD_HIGHLIGHT) {
            scaffoldText = this.getScaffold(div) || '';
            if (!scaffoldText) {
                return this.getMolCoords(div, false);
            }
        }
        const molText = this.getMol(div);
        let res = {
            pickle: new Uint8Array(),
            match: null,
            svg: null,
        };
        if (molText) {
            const divId = this.getDivId(div)
            res = await this.requestMolPickle(divId, molText, scaffoldText, userOpts);
        }
        return res;
    },

    /**
     * Get related node HTML tag and content for a given div
     * as a key: value dictionary.
     * @param {Element} div
     * @returns {object} object containing HTML tag name and
     * content as a key: value dictionary
     */
    getRelatedNodes: function(div) {
        return Object.fromEntries(this.relatedNodes().map(k =>
            [dashToCamelCase(k), div.getAttribute(dataAttr(k))]));
    },

    /**
     * For a given div, get the object corresponding to
     * the content of an HTML tag encoded as JSON string.
     * @param {Element} div
     * @param {string}  opt HTML tag name
     * @returns {object} object parsed from a JSON string
     */
    getJsonOpt: function(div, opt) {
        let value = null;
        const attr = dataAttr(opt);
        if (div.hasAttribute(attr)) {
            value = div.getAttribute(attr);
            try {
                value = JSON.parse(value);
            } catch (e) {
                value = null;
            }
        }
        return value;
    },

    /**
     * For a given div, set an HTML tag to a JSOn-encoded
     * key: value dictionary. If the dictionary is empty,
     * the HTML tag is removed from the div.
     * @param {Element} div
     * @param {string} opt HTML tag name
     * @param {object} value key: value dictionary
     */
    setJsonOpt: function(div, opt, value) {
        let jsonValue = null;
        const attr = dataAttr(opt);
        if (value) {
            try {
                jsonValue = JSON.stringify(value);
            } catch (e) {
                jsonValue = null;
            }
        }
        if (jsonValue) {
            div.setAttribute(attr, jsonValue);
        } else {
            div.removeAttribute(attr);
        }
    },

    /**
     * For a given div, get the draw options encoded as
     * a JSON string. The draw options which are not defined
     * in the div are replaced by default values.
     * @param {Element} div
     * @returns {object} draw options as a key: value dictionary
     */
    getDrawOpts: function(div) {
        return {...this.getDefaultDrawOpts(), ...(this.getJsonOpt(div, this.getDivAttrs().DRAW_OPTS) || {})};
    },

    /**
     * For a given div, set the draw options encoded as
     * a JSON string. Only the draw options that differ from
     * the default values are stored in the div.
     * @param {Element} div
     * @param {object} opts options as a key: value dictionary
     */
    setDrawOpts: function(div, opts) {
        let haveNonDefaultOpts = false;
        const nonDefaultOpts = Object.fromEntries(Object.entries(opts).filter(([k, v]) => {
            const defaultValue = this.getDefaultDrawOpt(k);
            const noDefaultValue = (typeof defaultValue === 'undefined');
            const isDefaultOpt = ((noDefaultValue && v) || (!noDefaultValue && defaultValue !== v));
            haveNonDefaultOpts |= isDefaultOpt;
            return isDefaultOpt;
        }));
        this.setJsonOpt(div, this.getDivAttrs().DRAW_OPTS, haveNonDefaultOpts ? nonDefaultOpts : null);
    },

    /**
     * For a given div, set the boolean value of an option.
     * @param {Element} div
     * @param {string}  opt HTML tag name holding the option value
     * @param {boolean} value
     */
    setBoolOpt: function(div, opt, value) {
        div.setAttribute(dataAttr(opt), value ? true : false);
    },

    /**
     * Write the 2D layout for molecule mol to the HTML Element
     * molDraw (either canvas or SVG div) using drawing options
     * specified in drawOpts. In case of failure it will try
     * again with kekulization switched off before giving up.
     * @param {JSMol|string} mol RDKitJS molecule or SVG string
     * @param {object} drawOpts dictionary with drawing options
     * @param {Element} molDraw optional; HTML Element (either canvas or SVG div)
     * @@returns {string} result of the drawing call or null if failure
     */
    write2DLayout: function(mol, drawOpts, molDraw) {
        const _write2DLayout = (mol, drawOpts, molDraw) => {
            let svg;
            if (typeof mol === 'object') {
                if (!mol?.is_valid()) {
                    return null;
                }
                const drawOptsText = JSON.stringify(drawOpts);
                const type = molDraw?.nodeName;
                if (type) {
                    if (type === 'CANVAS') {
                        molDraw.width = drawOpts.width;
                        molDraw.height = drawOpts.height;
                        return mol.draw_to_canvas_with_highlights(molDraw, drawOptsText);
                    } else if (type !== 'DIV') {
                        console.error(`write2DLayout: unsupported nodeName ${type}`);
                        return null;
                    }
                }
                svg = mol.get_svg_with_highlights(drawOptsText);
            } else if (typeof mol === 'string') {
                svg = mol;
            } else {
                console.error('write2DLayout: expected JSMol or SVG string');
                svg = '';
            }
            if (molDraw?.style) {
                molDraw.style.width = drawOpts.width;
                molDraw.style.height = drawOpts.height;
                molDraw.innerHTML = svg;
            }
            return svg;
        }
        let res = null;
        try {
            res = _write2DLayout(mol, drawOpts, molDraw);
        } catch {
            try {
                res = _write2DLayout(mol, { ...drawOpts, kekulize: false }, molDraw);
            } catch {
                // if we fail we draw nothing
            }
        }
        return res;
    },

    /**
     * Update the molecule visualized in div.
     * A spinning wheel is displayed until the new layout
     * is ready.
     * @param {Element} div
     * @param {bool} returnMolBlock if true returns the drawn
     * molecule as molblock
     * @returns {Promise} a promise that resolves to null
     * if the jobs was aborted, to a molblock if returnMolBlock === true,
     * and to '' otherwise.
     */
    draw: async function(div, returnMolBlock) {
        // if the div has 0 size, do nothing, as it may have
        // already been unmounted
        const divRect = div.getBoundingClientRect();
        if (!divRect.width || !divRect.height) {
            return null;
        }
        // get a spinner wheel with a radius appropriate
        // to the size of div
        const spinner = this.getSpinner(div);
        let molblock = '';
        const _asyncDraw = async (tid) => {
            const rdkitModulePromise = this.getRDKitModule();
            // get the HTML element where we are going to draw
            const molDraw = this.getMolDraw(div);
            const userOpts = this.getUserOptsForDiv(div);
            const drawOpts = this.getDrawOpts(div);
            drawOpts.addAtomIndices = userOpts.ATOM_IDX;
            drawOpts.width = Math.round(divRect.width);
            drawOpts.height = Math.round(divRect.height);
            let { pickle, match } = this.getCurrentMol(div);
            const scaffold = this.getScaffold(div);
            const failsMatch = this.getFailsMatch(div, scaffold);
            const needMatch = (userOpts.SCAFFOLD_ALIGN || userOpts.SCAFFOLD_HIGHLIGHT);
            const divId = this.getDivId(div);
            if (!pickle) {
                const promArray = [];
                // if the user wants to align to a scaffold or highlight
                // the scaffold, we need an aligned layout + matches
                if (needMatch && !failsMatch) {
                    promArray.push(this.getMolCoords(div, userOpts));
                }
                // if the user does not want to align to a scaffold, we
                // need an unaligned layout
                if (!userOpts.SCAFFOLD_ALIGN || failsMatch) {
                    promArray.push(this.getMolCoords(div, {
                        ...userOpts,
                        SCAFFOLD_ALIGN: false,
                        SCAFFOLD_HIGHLIGHT: false,
                    }));
                }
                const resArray = await Promise.all(promArray);
                if (resArray.every(res => res)) {
                    // if a match was requested, it will be in the first Promise
                    // otherwise it will be undefined
                    const firstRes = resArray[0];
                    const lastRes = resArray[resArray.length - 1];
                    match = firstRes.match;
                    // the pickle will always be from the last promise
                    pickle = lastRes.pickle;
                }
            }
            if (pickle) {
                this.setCurrentMol(div, pickle, match);
                if (needMatch) {
                    if (!match) {
                        this.setFailsMatch(div, scaffold);
                    } else {
                        this.clearFailsMatch(div);
                    }
                }
                if (userOpts.SCAFFOLD_HIGHLIGHT && match) {
                    Object.assign(drawOpts, match);
                } else {
                    delete drawOpts.atoms;
                    delete drawOpts.bonds;
                }
                const useSvg = (molDraw?.nodeName === 'DIV');
                if (useSvg) {
                    const res = await this.requestSvg(divId, pickle, { drawOpts, ...userOpts });
                    if (res?.svg) {
                        this.write2DLayout(res.svg, drawOpts, molDraw);
                    }
                }
                if (!useSvg || returnMolBlock) {
                    // block until rdkitModule is ready
                    const rdkitModule = await rdkitModulePromise;
                    const mol = rdkitModule.get_mol_from_uint8array(pickle);
                    if (mol) {
                        if (mol.is_valid()) {
                            if (returnMolBlock) {
                                molblock = getMolblockFromMol(mol);
                            }
                            if (!useSvg) {
                                if (userOpts.ABBREVIATE) {
                                    mol.condense_abbreviations();
                                }
                                this.write2DLayout(mol, drawOpts, molDraw);
                            }
                        }
                        mol.delete();
                    }
                }
            }
            const currentDiv = this.currentDivs().get(divId) || {};
            if (!currentDiv.childQueue) {
                spinner.style.display = 'none';
            }
            if (tid) {
                clearTimeout(tid);
            }
            return molblock;
        };
        const tid = setTimeout(() => {
            spinner.style.display = 'block';
        }, this.getWhlOpts().TIMEOUT);
        return _asyncDraw(tid);
    },

    /**
     * Called when the copy or cog buttons are clicked.
     * @param {Event} e the click event
     * @param {string} buttonType either 'copy' or 'cog'
     * @param {Element} div
     * @returns {function} either the copyAction or cogAction function
     */
    onButtonAction: function(e, buttonType, div) {
        e.stopPropagation();
        return this[buttonType + 'Action'](div);
    },

    /**
     * Put content on the clipboard.
     * @param {object} content key: value dictionary containing
     * data (value) for each MIME type (key)
     * @returns {boolean} true if copy to clipboard succeeded, false
     * if it failed
     */
    putClipboardContent: async function(content) {
        // eslint-disable-next-line no-undef
        const item = new ClipboardItem(content);
        let res;
        try {
            await navigator.clipboard.write([item]);
            res = true;
        } catch (e) {
            console.error('%O', e);
            this.logClipboardError(`write content`);
            res = false;
        }
        return res;
    },

    /**
     * Return a { molblock, smiles, inchi } dictionary
     * containing the respective chemical representations
     * associated to a given mol pickle.
     * @param {UInt8Array} pickle
     * @returns {object} dictionary with chemical representations
     */
    getChemFormatsFromPickle: async function(pickle) {
        const rdkitModule = await this.getRDKitModule();
        const mol = rdkitModule.get_mol_from_uint8array(pickle);
        let molblock = '';
        let smiles = '';
        let inchi = '';
        if (mol) {
            if (mol.is_valid()) {
                molblock = getMolblockFromMol(mol);
                try {
                    smiles = mol.get_smiles();
                } catch(e) {
                    console.error(`Failed to generate SMILES (${e})`);
                }
                try {
                    inchi = mol.get_inchi();
                } catch(e) {
                    console.error(`Failed to generate InChI (${e})`);
                }
            }
            mol.delete();
        }
        return { molblock, smiles, inchi };
    },

    /**
     * Put some content from a given div on the clipboard.
     * @param {Element} div
     * @param {Array<String>} formats array of formats
     * to be copied to clipboard ('png', 'svg', 'molblock')
     */
    putClipboardItem: async function(div, formats) {
        const divRect = div.getBoundingClientRect();
        this.setButtonsEnabled(div, false);
        const userOpts = this.getUserOptsForDiv(div);
        const { pickle, match } = this.getCurrentMol(div);
        const rdkitModule = await this.getRDKitModule();
        const mol = rdkitModule.get_mol_from_uint8array(pickle);
        if (mol) {
            if (mol.is_valid()) {
                if (userOpts.ABBREVIATE) {
                    mol.condense_abbreviations();
                }
                const hasPng = formats.includes('png');
                const hasSvg = formats.includes('svg');
                let drawOpts;
                if (hasPng || hasSvg) {
                    drawOpts = this.getDrawOpts(div);
                    if (userOpts.SCAFFOLD_HIGHLIGHT) {
                        Object.assign(drawOpts, match);
                    } else {
                        delete drawOpts.atoms;
                        delete drawOpts.bonds;
                    }
                    drawOpts.addAtomIndices = userOpts.ATOM_IDX;
                    drawOpts.fixedBondLength *= this.copyImgScaleFac;
                    drawOpts.width = Math.round(divRect.width * this.copyImgScaleFac);
                    drawOpts.height = Math.round(divRect.height * this.copyImgScaleFac);
                }
                const content = {};
                let exc = '';
                let res = false;
                if (formats.includes('molblock')) {
                    const type = 'text/plain';
                    const molblock = getMolblockFromMol(mol);
                    content[type] = new Blob([molblock], { type });
                } else if (hasSvg) {
                    // at the moment svg+xml MIME type is not supported by browsers
                    // so we copy as plain text. This means SVG text will clobber molblock
                    try {
                        const svgText = this.write2DLayout(mol, drawOpts);
                        if (typeof svgText === 'string') {
                            const type = 'text/plain';
                            content[type] = new Blob([svgText], { type });
                            await this.putClipboardContent(content);
                            res = true;
                        }
                    } catch(e) {
                        exc = ` (${e})`;
                    }
                    if (!res) {
                        this.logClipboardError(`generate SVG image${exc}`);
                    }
                }
                if (hasPng && !hasSvg) {
                    const canvas = document.createElement('canvas');
                    try {
                        if (this.write2DLayout(mol, drawOpts, canvas) !== null) {
                            canvas.toBlob(async image => {
                                if (image) {
                                    content['image/png'] = image;
                                } else {
                                    this.logClipboardError('generate PNG image');
                                }
                                if (Object.keys(content).length) {
                                    await this.putClipboardContent(content);
                                }
                            });
                            res = true;
                        }
                    } catch(e) {
                        exc = ` (${e})`;
                    }
                    if (!res) {
                        this.logClipboardError(`draw to canvas${exc}`);
                        if (Object.keys(content).length) {
                            await this.putClipboardContent(content);
                        }
                    }
                }
            }
            mol.delete();
        }
        this.setButtonsEnabled(div, true);
    },

    /**
     * Called when the copy button on a given div is clicked.
     * @param {Element} div
     */
    copyAction: async function(div) {
        if (await this.canAccessClipboard()) {
            await this.putClipboardItem(div, ['png', 'molblock']);
        }
    },

    /**
     * Called when the cog button on a given div is clicked.
     * @param {Element} div
     */
    cogAction: async function(div) {
        if (!this.settings) {
            this.settings = this.createSettingsDialog();
        }
        this.showOrHideSettings(div);
    },

    /**
     * Show the settings dialog.
     * Override to carry out specific actions before/after.
     */
    showSettings: function() {
        this.settings.show();
    },

    /**
     * Hide the settings dialog.
     * Override to carry out specific actions before/after.
     */
    hideSettings: function() {
        this.settings.hide();
    },

    /**
     * Toggles the SettingsDialog visibility status
     * when cog button on a given div is clicked.
     * @param {Element} div
     */
    showOrHideSettings: function(div) {
        const divId = this.getDivId(div);
        // if the SettingsDialog was visible and the user clicked
        // on the cog where the SettingsDialog currently is, hide it
        // otherwise show it on div
        if (this.settings.isVisible && divId === this.settings.currentDivId) {
            this.hideSettings();
        } else {
            this.settings.setMolDiv(div);
            this.showSettings();
        }
    },

    /**
     * Creates a button Element of the desired type
     * if it does not yet exist and returns a copy.
     * @param {string} buttonType either 'copy' or 'cog'
     * @returns {Element} HTML button element
     */
    createButton: function(buttonType) {
        this.buttons = this.buttons || {};
        if (!this.buttons[buttonType]) {
            const button = document.createElement('button');
            button.className = `button ${buttonType}`;
            button.name = `${buttonType}-button`;
            button.type = 'button';
            button.appendChild(this.getButtonIcon(buttonType));
            this.buttons[buttonType] = button;
        }
        return this.buttons[buttonType].cloneNode(true);
    },

    /**
     * Sets the radius of the spinning wheel based on the size
     * of the outer container.
     * @param {Element} spinner spinner div
     * @param {number} containerHeight height of the container (px)
     * @param {number} containerWidth width of the container (px)
     */
    setSpinnerWhlRadius: function(spinner, containerHeight, containerWidth) {
        const whlRadius = Math.round(containerHeight * this.getWhlOpts().SCALE);
        let marginTop = Math.round(0.5 * (containerHeight - whlRadius)) - this.getWhlOpts().WIDTH;
        marginTop = `margin-top: ${marginTop}px; `;
        let marginLeft = '';
        if (containerWidth) {
            marginLeft = Math.round(0.5 * (containerWidth - whlRadius)) - this.getWhlOpts().WIDTH;
            marginLeft = `margin-left: ${marginLeft}px; `;
        }
        const style = `${marginTop}${marginLeft}width: ${whlRadius}px; ` +
            `height: ${whlRadius}px; border-width: ${this.getWhlOpts().WIDTH}px`
        spinner.firstChild.style = style;
    },

    /**
     * Creates a new spinner if it does not yet exist and returns a copy
     * of the spinner with a radius appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} spinner div
     */
    createSpinner: function(div) {
        if (!this.spinner) {
            const spinner = document.createElement('div');
            spinner.className = 'rdk-str-rnr-spinner';
            const spinnerWhl = document.createElement('div');
            spinnerWhl.className = 'whl';
            spinner.appendChild(spinnerWhl);
            this.spinner = spinner;
        }
        const spinner = this.spinner.cloneNode(true);
        const divHeight = div.getBoundingClientRect().height;
        this.setSpinnerWhlRadius(spinner, divHeight)
        return spinner;
    },

    /**
     * Adds a spinner to a given div and returns the spinner.
     * @param {Element} div container div
     * @returns {Element} spinner div
     */
    getSpinner: function(div) {
        let spinner = div.getElementsByTagName('div');
        if (!spinner.length) {
            spinner = this.createSpinner(div);
            div.appendChild(spinner);
        } else {
            spinner = spinner[0];
        }
        return spinner;
    },

    /**
     * Creates an SVG div if it does not yet exist and
     * returns a copy of size appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} SVG div
     */
    createSvgDiv: function(div) {
        if (!this.svgDiv) {
            const svgDiv = document.createElement('div');
            svgDiv.setAttribute('name', 'mol-draw');
            svgDiv.className = 'rdk-str-rnr-mol-draw';
            svgDiv.appendChild(document.createTextNode(' '));
            this.svgDiv = svgDiv;
        }
        const svgDiv = this.svgDiv.cloneNode(true);
        const divRect = div.getBoundingClientRect();
        const width = Math.round(divRect.width);
        const height = Math.round(divRect.height);
        svgDiv.setAttribute('style', `width: ${width}; height: ${height};`);
        return svgDiv;
    },

    /**
     * Creates a canvas element if it does not yet exist and
     * returns a copy of size appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} canvas
     */
    createCanvas: function(div) {
        if (!this.canvas) {
            const canvas = document.createElement('canvas');
            canvas.setAttribute('name', 'mol-draw');
            this.canvas = canvas;
        }
        const canvas = this.canvas.cloneNode(true);
        const divRect = div.getBoundingClientRect();
        const width = Math.round(divRect.width);
        const height = Math.round(divRect.height);
        if (width) {
            canvas.width = Math.round(divRect.width);
        }
        if (height) {
            canvas.height = Math.round(divRect.height);
        }
        return canvas;
    },

    /**
     * Creates an array of HTML tag names (no data- prefix)
     * if it does not yet exist and returns it.
     * @returns {Array<string>} array of HTML attribute names
     */
    divTags: function() {
        if (!this._divTags) {
            this._divTags = Object.values(this.getDivAttrs());
        }
        return this._divTags;
    },

    /**
     * Creates an array of user-defined option names (no data- prefix)
     * if it does not yet exist and returns it.
     * @returns {Array<string>} array of user-defined option names
     */
    userTags: function() {
        if (!this._userTags) {
            this._userTags = Object.values(this.getUserOpts()).map(item => item.tag);
        }
        return this._userTags;
    },

    /**
     * Creates an array of all HTML tags (no data- prefix)
     * if it does not yet exist and returns it.
     * @returns {Array<string>} array of HTML tags
     */
     allTags: function() {
        if (!this._allTags) {
            this._allTags = this.divTags().concat(this.userTags());
        }
        return this._allTags;
    },

    /**
     * Update the cache of user-defined options for a given div or divId.
     * If the value of the option is a boolean and is the same
     * as the default value for that option, the key for that option
     * is removed from the cache. If no keys are left, the whole entry
     * for that div is removed.
     * Note that the div is identified by a key computed by getCacheKey().
     * @param {Element|string} div
     * @param {string} userOpt name of the user-defined option
     * @param {boolean|string|null} value value to be stored
     */
    updateUserOptCache: function(div, userOpt, value) {
        const key = this.getCacheKey(div);
        const cachedEntry = this.userOptCache[key] || {};
        if (userOpt) {
            const isBool = (typeof value === 'boolean');
            const cachedValue = cachedEntry[userOpt];
            if (value !== null && (!isBool || typeof cachedValue === 'undefined')) {
                cachedEntry[userOpt] = value;
            } else if (value === null || (isBool && cachedValue !== value)) {
                delete cachedEntry[userOpt];
            }
        }
        if (Object.keys(cachedEntry).length) {
            this.userOptCache[key] = cachedEntry;
        } else {
            delete this.userOptCache[key];
        }
    },

    /**
     * Get the value of a user-defined boolean option from cache
     * for a given div.
     * Note that the div is identified by a key computed by getCacheKey().
     * If the cached value does not exist, returns unspecified
     * @param {Element} div
     * @param {string} userOpt name of the user-defined option
     * @returns {boolean|string} cached value, or unspecified if there
     * is no value associated to userOpt in the cache
     *
     */
    getCachedValue: function(div, userOpt) {
        const key = this.getCacheKey(div);
        const cachedEntry = this.userOptCache[key];
        let cachedValue;
        if (cachedEntry) {
            cachedValue = cachedEntry[userOpt];
        }
        return cachedValue;
    },

    /**
     * Get the value of a user-defined boolean option from cache
     * for a given div.
     * Note that the div is identified by a key computed by getCacheKey().
     * If no cached value exists, the value is read from the div.
     * @param {Element} div
     * @param {string} userOpt name of the user-defined option
     * @returns {boolean} true if the option is checked,
     * false if not
     */
    getBoolOpt: function(div, userOpt) {
        let cachedValue = this.getCachedValue(div, userOpt);
        return (typeof cachedValue !== 'undefined' ? cachedValue :
            this.toBool(div.getAttribute(dataAttr(userOpt))));
    },

    /**
     * Convert HTML attribute to bool.
     * @param {string} v HTML value obtained calling Element.getAttribute
     * @returns true if v is a string and not falsy
     */
    toBool: (v) => {
        let res = false;
        if (typeof v === 'string') {
            v = v.toLowerCase();
            res = (v !== 'false' && v !== 'null' && v !== '0');
        }
        return res;
    },

    /**
     * Returns true if the given div was previously found
     * not to match the given scaffold definition.
     * @param {Element} div
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     * @returns {boolean} true if the given div was previously
     * found not to match this scaffold, false if not
     */
    getFailsMatch: function(div, scaffold) {
        return (this.getCachedValue(div, NO_MATCH) === scaffold);
    },

    /**
     * Mark the given div as failing to match the given
     * scaffold definition.
     * @param {Element} div
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     */
    setFailsMatch: function(div, scaffold) {
        this.updateUserOptCache(div, NO_MATCH, scaffold);
    },

    /**
     * Clear the 'fails scaffold match' flag on the given div.
     * @param {Element} div
     */
    clearFailsMatch: function(div) {
        this.setFailsMatch(div, null);
    },

    /**
     * Called when a div with given divId is removed from the DOM.
     * All jobs associated to that divId are aborted as their results
     * are not needed anymore, and any cached attributes associated
     * to that divId are also removed.
     * Note that this does not include the user-defined visualization
     * options that the user may have changed through SettingsDialog,
     * which are persisted in a different cache.
     * @param {Element} divId id of the div that has been removed
     */
    removeDiv: function(divId) {
        if (this.settings?.molDiv) {
            const molDivId = this.getDivId(this.settings.molDiv);
            if (divId === molDivId) {
                this.hideSettings();
            }
        }
        this.scheduler().mainQueue.abortJobs(divId);
        this.currentDivs().delete(divId);
        this.decRef(divId);
        this.updateUserOptCache(divId);
    },

    /**
     * Update the div with a given divId.
     * An optional callback can be passed which will be called
     * whenever the user changes visualization options:
     * userOptsCallback(divId, field, isChecked, molblock)
     * where:
     * - divId is the identifier of the div
     * - field is the name of the attribute changed by the user
     * - isChecked is the boolean value of the attribute
     * - molblock is the current set of coordinates
     * @param {Element} div
     * @param {function} userOptsCallback optional callback
     */
    updateMolDrawDiv: function(divId, userOptsCallback) {
        this.incRef(divId);
        const div = this.getMolDiv(divId);
        if (!div) {
            return;
        }
        this.getSpinner(div);
        this.clearCurrentMol(div);
        const divAttrs = Object.fromEntries(this.allTags().map(tag =>
            [tag, div.getAttribute(dataAttr(tag))]));
        divAttrs.userOptsCallback = userOptsCallback;
        this.currentDivs().set(divId, divAttrs);
        this.getButtonTypes().forEach(buttonType => {
            let button = this.getButton(div, buttonType);
            const shouldHide = this.toBool(divAttrs[`hide-${buttonType}`]);
            if (!shouldHide && !button) {
                button = this.createButton(buttonType);
                button.onclick = (e) => this.onButtonAction(e, buttonType, div);
                div.appendChild(button);
            } else if (shouldHide && button) {
                button.remove();
            }
        });
        const useSvg = this.toBool(divAttrs[this.getDivAttrs().USE_SVG]);
        let molDraw = this.getMolDraw(div);
        if (molDraw) {
            const isSvg = (molDraw.nodeName === 'DIV');
            if (isSvg ^ useSvg) {
                molDraw.remove();
                molDraw = null;
            }
        }
        if (!molDraw) {
            div.appendChild(useSvg ? this.createSvgDiv(div) : this.createCanvas(div));
        }
        this.draw(div);
        if (this.settings?.isVisible && divId === this.settings.currentDivId) {
            this.hideSettings();
        }
    },

    /**
     * For a given div, it will check if the div needs to be updated
     * and will do so if needed.
     * @param {Element} div
     */
     updateMolDrawDivIfNeeded: function(divId, userOptsCallback) {
        const div = this.getMolDiv(divId);
        if (!div) {
            return;
        }
        let currentDivValue;
        let shouldDraw = false;
        if (!shouldDraw) {
            // if this divId has not been seen before, it needs to
            // be drawn
            currentDivValue = this.currentDivs().get(divId);
            if (!currentDivValue) {
                shouldDraw = true;
            }
        }
        // if it was seen before, we may still need to redraw
        // if some attribute changed
        if (!shouldDraw) {
            shouldDraw = this.allTags().some(tag => {
                const divAttrValue = div.getAttribute(dataAttr(tag));
                const currentDivAttrValue = currentDivValue[tag];
                return (typeof currentDivAttrValue !== 'undefined' && divAttrValue !== currentDivAttrValue);
            });
        }
        // if a redraw is needed, update
        if (shouldDraw) {
            this.updateMolDrawDiv(divId, userOptsCallback);
        }
    },

    /**
     * Update any div whose attributes have changed.
     */
    updateMolDrawDivs: function(userOptsCallback) {
        const seenDivKeys = new Set();
        const divArray = this.getMolDivArray();
        divArray.forEach(div => {
            const divId = this.getDivId(div);
            this.updateMolDrawDivIfNeeded(divId, userOptsCallback);
            seenDivKeys.add(divId);
        });
        // purge any div which is not mounted anymore from the cache
        this.currentDivs().forEach((v, k) => {
            if (!seenDivKeys.has(k)) {
                this.currentDivs().delete(k);
            }
        });
    },

    /**
     * Dictionary where user viualization preferences
     * for each divId are stored.
     */
    userOptCache: {},

     /**
      * Current scaling factor used for images copied to clipboard.
      */
    copyImgScaleFac: 1,
};

export default Renderer;
