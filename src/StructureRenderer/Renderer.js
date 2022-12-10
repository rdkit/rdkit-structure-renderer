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
import Dispatcher from './Dispatcher.js';
import LocalDispatcher from './LocalDispatcher.js';
import SettingsDialog from './SettingsDialog.js';
import ButtonTooltip from './ButtonTooltip.js';
import {
    getMinimalLibBasename,
    cssToText,
    decodeNewline,
    dataAttr,
    dashToCamelCase,
    getMolblockFromMol,
    getMolFromUInt8Array,
    keyToTag,
} from './utils.js';
import {
    DEFAULT_IMG_OPTS,
    DEFAULT_DRAW_OPTS,
    RDK_STR_RNR,
    DIVID_SEPARATOR,
    DIV_ATTRS,
    BUTTON_TYPES,
    USER_OPTS,
    NO_MATCH,
    WAS_REBUILT,
    CLIPBOARD_OPTS,
    WHL_OPTS,
} from './constants.js';
import { version as packageVersion } from '../version.js';


var _RDKitModule;
const haveWindow = (typeof window !== 'undefined');
const _window = (haveWindow ? window : {
    devicePixelRatio: 1,
});
const haveWorker = (typeof Worker !== 'undefined');
const haveWebAssembly = (() => {
    try {
        if (typeof WebAssembly === "object"
            && typeof WebAssembly.instantiate === "function") {
            const module = new WebAssembly.Module(Uint8Array.of(0x0, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00));
            if (module instanceof WebAssembly.Module)
                return new WebAssembly.Instance(module) instanceof WebAssembly.Instance;
        }
    } catch (e) {
    }
    return false;
})();

const Renderer = {
    /**
     * Override to change, currently hardware concurrency minus 2.
     * @returns {number} Hardware concurrency
     */
    getHardwareConcurrency: () => Math.max(((typeof navigator !== 'undefined'
        && navigator.hardwareConcurrency) || 1) - 2, 1),

    /**
     * Override to change, currently capped to 8.
     * @returns {number} Maximum allowed concurrency independently of hardware
     */
    getMaxConcurrency: () => haveWebAssembly && haveWorker ? 8 : 0,

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
     * Override to use a different RdkStrRnr prefix.
     * @returns {string} the RdkStrRnr prefix
     */
    getRdkStrRnrPrefix: () => RDK_STR_RNR,

    /**
     * Override to use a different divId prefix.
     * @returns {string} the divId prefix
     */
    getDivIdPrefix: function() {
        return this.getRdkStrRnrPrefix() + 'mol-';
    },

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
     * Override to use different button types.
     * @returns {Array<object>} an array of objects describing
     * button names and tooltips
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
     * Override to use a different CSS style.
     * @returns {object} CSS style used by Renderer as a key, value dictionary
     */
    getRendererCss: () => defaultRendererCss,

    /**
     * Sets the available user opt entries. Call with custom
     * userOpts to customize user opt entries.
     * @param {object} userOpts optional custom user opts
     */
    setAvailUserOpts: function(userOpts) {
        this._userOpts = Object.fromEntries(
            Object.entries(userOpts || this.getDefaultUserOpts()).map(([k, text]) =>
                [k, { tag: keyToTag(k), text }]));
    },

    /**
     * Get default user opt entries.
     * @returns {object} key, value user opt dictionary
     */
    getDefaultUserOpts: () => USER_OPTS,

    /**
     * Get available user opts as a { key: { tag, text } } dictionary.
     * @returns {object} a dictionary relating tag keys to a { tag, text }
     * dictionary where tag is the HTML tag name and text is the label
     * displayed in the SettingsDialog. If text is null, the entry is not
     * displayed in the SettingsDialog, but can still be set programmatically
     * through the HTML tag
     */
    getAvailUserOpts: function() {
        if (!this._userOpts) {
            this.setAvailUserOpts();
        }
        return this._userOpts;
    },

    /**
     * Get current user opts for a certain key as a key, value dictionary.
     * Note that if there are multiple divs relating to the same key,
     * the values from the first div will be picked.
     * @returns {object} a dictionary relating opt name (all uppercase) to value
     */
    getUserOptsForKey: function(key) {
        const divId = this.getFirstDivIdFromDivIdOrKey(key);
        let div;
        if (divId) {
            div = this.getMolDiv(divId);
        }
        return this.getUserOptsForDiv(div || key) || {};
    },

    /**
     * Set user opts for a certain key from a key, value dictionary.
     * All divs related to the same key will be updated.
     * @param {object} opts dictionary relating opt name (all uppercase) to value
     */
    setUserOptsForKey: function(key, opts) {
        const userOpts = this.getAvailUserOpts();
        Object.entries(opts).forEach(([opt, value]) => {
            const tag = userOpts[opt]?.tag;
            tag && this.updateUserOptCache(key, tag, value);
        });
        this.getDivIdArrayFromDivIdOrKey(key).forEach(
            divId => this.updateMolDrawDivIfNeeded(divId));
    },

    /**
     * Get boolean or string user options for a given div or divId.
     * @param {Element|string} div div or divId
     * @returns {object} dictionary mapping each userOpt key to its
     * boolean or string value
     */
    getUserOptsForDiv: function(div) {
        return Object.fromEntries(Object.entries(this.getAvailUserOpts()).map(
            ([k, { tag }]) => [k, this.getDivOpt(div, tag)]).filter(
                ([, v]) => typeof v !== 'undefined'));
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
     * Return div containing the SVG icon for type.
     * @param {string} type 'copy' or 'cog'
     * @returns {Element} HTML div containing the SVG icon
     */
    getButtonIcon: function(type) {
        const div = document.createElement('div');
        const span = document.createElement('span');
        div.appendChild(span);
        span.className = this.getRdkStrRnrPrefix() + 'button-icon';
        span.innerHTML = defaultIcons[type];
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
                this.getAvailUserOpts()).filter(({ text }) => text !== null);
        }
        return this._checkableUserOpts;
    },

    /**
     * Set the rdkit-structure-renderer style to the
     * passed CSS, or to the default CSS if the passed
     * css is falsy
     * @param {object} css key, value dictionary
     */
    setRendererCss: function(css) {
        const RDK_CSS_ID = this.getRdkStrRnrPrefix() + 'css';
        let style = document.getElementById(RDK_CSS_ID);
        // if style already exists and no css is passed,
        // do nothing
        if (style && !css) {
            return;
        }
        css = css || this.getRendererCss();
        css = cssToText(css);
        if (!style) {
            style = document.createElement('style');
            const styleText = document.createTextNode(css);
            style.id = RDK_CSS_ID;
            style.setAttribute('type', 'text/css');
            style.appendChild(styleText);
            document.head.appendChild(style);
        } else {
            style.firstChild.innerHTML = css;
        }
    },

    /**
     * Called to initialize the RDKitModule used by UI and load CSS
     * into the current HTML document. If the URL of the MinimalLib
     * JS loader, MinimalLib will be loaded from there, otherwise
     * it will be loaded from the default location.
     * @param {string} minimalLibPath (optional) URL containing RDKit_minimal
     * @param {string} basename (optional) basename of the main library
     * @returns {Promise} Promise that resolves to the RDKit module
     * once the latter is loaded and initialized
     */
    init: function(minimalLibPath, basename) {
        if (!basename) {
            basename = getMinimalLibBasename();
            if (!haveWebAssembly) {
                basename += "_plainJs";
            }
        }
        if (this.isRDKitReady()) {
            return Promise.resolve(this);
        }
        if (!this._minimalLibJs) {
            if (typeof minimalLibPath !== 'string') {
                minimalLibPath = document.currentScript?.src || '';
                minimalLibPath = minimalLibPath.substring(0, minimalLibPath.lastIndexOf('/'));
            } else if (minimalLibPath.length && minimalLibPath[minimalLibPath.length - 1] === '/') {
                minimalLibPath = minimalLibPath.substring(0, minimalLibPath.length - 1);
            }
            this._minimalLibPath = minimalLibPath;
            this._minimalLibJs = `${this._minimalLibPath}/${basename}.${packageVersion}.js`;
            if (!haveWindow) {
                const modulePaths = ['', ...module.paths];
                if (!modulePaths.some(path => {
                    try {
                        minimalLibPath = (path ? path + '/' : path) + this._minimalLibJs;
                        // Using backticks avoids the following webpack warning:
                        // 'Critical dependency: the request of a dependency is an expression'
                        _window.initRDKitModule = require(`${minimalLibPath}`);
                    } catch(e) {
                        if (e.code !== 'MODULE_NOT_FOUND') {
                            throw e;
                        }
                        return false;
                    }
                    this._minimalLibPath = minimalLibPath.substring(0, minimalLibPath.lastIndexOf('/'));
                    this._minimalLibJs = minimalLibPath;
                    return true;
                })) {
                    throw Error(`Failed to find module ${this._minimalLibJs}`);
                }
            }
            // create the Scheduler (which in turn may spawn WebWorkers)
            // if it has not been created yet
            this.scheduler();
        }
        // if the RDKit module has already been initialzed, return it
        const _loadRDKitModule = (resolve) => {
            const TIMEOUT = 50;
            const RDK_LOADER_ID = this.getRdkStrRnrPrefix() + 'loader';
            if (typeof _RDKitModule === 'undefined') {
                console.log(`rdkit-structure-renderer version: ${packageVersion}`);
                _RDKitModule = null;
                if (haveWindow && !document.getElementById(RDK_LOADER_ID)) {
                    const rdkitLoaderScript = document.createElement('script');
                    rdkitLoaderScript.id = RDK_LOADER_ID;
                    rdkitLoaderScript.src = this._minimalLibJs;
                    rdkitLoaderScript.async = true;
                    rdkitLoaderScript.onload = () => _loadRDKitModule(resolve);
                    document.head.appendChild(rdkitLoaderScript);
                }
            }
            if (_window.initRDKitModule || _RDKitModule) {
                let res = this;
                if (!_RDKitModule) {
                    if (typeof _window.initRDKitModule !== 'function') {
                        throw Error('_loadRDKitModule: initRDKitModule is not a function');
                    }
                    _RDKitModule = _window.initRDKitModule({
                        locateFile: () => `${this._minimalLibPath}/${basename}.${packageVersion}.wasm`
                    });
                    res = (async () => {
                        _RDKitModule = await _RDKitModule;
                        if (!this.isRDKitReady()) {
                            throw Error(`_loadRDKitModule: Failed to bootstrap ${this._minimalLibJs}`);
                        }
                        _window.initRDKitModule = undefined;
                        // uncomment to have the RDKitModule available in console for debugging
                        // _window.RDKitModule = _RDKitModule;
                        // uncomment to have the Renderer available in console for debugging
                        _window.RDKitStructureRenderer = this;
                        console.log('RDKit version: ' + _RDKitModule.version());
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
     * Get the divId from a div, removing, if present, the divId prefix
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
     * the divId prefix and, if present, the uniqueId before the ___ separator
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
     * Return divs corresponding to key.
     * @param {string} key cache key
     * @returns {Array<Element>} array of currently mounted mol divs
     * corresponding to key
     */
    getMolDivsForKey: function(key) {
        return document.querySelectorAll(`div[id$=${this.getDivIdSeparator()}${key}`);
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
            const iconSpan = button.firstChild.firstChild;
            modifyClass(iconSpan, 'disabled-icon', disable);
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
        this.getButtonTypes().forEach(({ type }) => {
            const button = this.getButton(div, type);
            button && this.setButtonEnabled(button, shouldEnable, useGreyOut);
        });
    },

    /**
     * Print an error message to the console if the copy
     * to clipboard operation failed.
     * @param {string} msg error message
     */
    logClipboardError: (msg) =>
        console.error(`${msg ? msg + '\n' : ''}Unable to copy to clipboard`),

    /**
     * Return true if clipboard can be accessed.
     * @returns {boolean} true if clipboard can be accessed
     */
    canAccessClipboard: async function() {
        let permissionStatus;
        try {
            permissionStatus = await navigator.permissions.query(this.getClipboardOpts());
        } catch {
            this.logClipboardError('Failed to query permissions');
            return false;
        }
        if (permissionStatus.state === 'denied') {
            this.logClipboardError('Failed to obtain permission');
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
            const concurrency = this.getConcurrency();
            const getDispatchers = concurrency
                ? () => [...Array(concurrency).keys()].map(i => new Dispatcher(i, this.getMinimalLibPath()))
                : () => [new LocalDispatcher(0, this.getRDKitModule())];
            this._scheduler = new Scheduler({
                getDispatchers,
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
     * @param {string} molText molecule description (SMILES, molblock or pkl_base64)
     * @param {string} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} opts rendering options
     * @returns {Promise} a Promise that will resolve to an object
     * containing the mol pickle (and possibly other results depending on
     * the job type), or to null if the job is aborted before being submitted
     */
    requestMolPickle: function(divId, molText, scaffoldText, opts) {
        if (!molText) {
            return Promise.resolve({
                pickle: null,
                match: null,
                svg: null,
                rebuild: null,
            });
        }
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
     * @returns {string} molecule description (SMILES, molblock, pkl_base64)
     */
    getMol: function(div) {
        const attr = dataAttr(this.getDivAttrs().MOL);
        return decodeNewline(div.getAttribute(attr) || '');
    },

    /**
     * Increment the number of references to key by one
     * @param {string} key cache key
     */
    incRef: function(key) {
        const cachedEntry = this.userOptCache[key] || {
            refCount: 0,
        };
        ++cachedEntry.refCount;
        this.userOptCache[key] = cachedEntry;
    },

    /**
     * Decrement the number of references to key by one
     * When the number drops to zero, cached coordinates are deleted.
     * @param {string} key cache key
     */
    decRef: function(key) {
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            if (cachedEntry.refCount) {
                --cachedEntry.refCount;
            }
            if (!cachedEntry.refCount) {
                delete cachedEntry.currentMol;
            }
        }
        this.updateUserOptCache(key);
    },

    /**
     * Get current molecule coordinates and match for a given key.
     * @param {string} key cache key
     * @returns {object|null} { pickle, match } dictionary for current mol
     */
    getCurrentMol: function(key) {
        return this.userOptCache[key]?.currentMol || null;
    },

    /**
     * Clear cached coordinates and match associated to a given key.
     * @param {string} key cache key
     */
    clearCurrentMol: function(key) {
        const cachedEntry = this.userOptCache[key];
        if (cachedEntry) {
            cachedEntry.currentMol = null;
        }
    },

    /**
     * Set current molecule coordinates and match for a given key.
     * @param {string} key cache key
     * @param {Uint8Array} pickle molecule pickle
     * @param {string} match scaffold match
     */
    setCurrentMol: function(key, pickle, match) {
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
     * @returns {string} scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator
     * ('$$$$', molblock)
     */
    getScaffold: function(div) {
        const attr = dataAttr(this.getDivAttrs().SCAFFOLD);
        return decodeNewline(div.getAttribute(attr) || '');
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
     * For a given div or divId, get the draw options encoded as
     * a JSON string. The draw options which are not defined
     * in the div are replaced by default values.
     * @param {Element|string} div div or divId
     * @returns {object} draw options as a key: value dictionary
     */
    getDrawOpts: function(div) {
        const res = { ...this.getDefaultDrawOpts() };
        if (typeof div === 'object') {
            Object.assign(res, this.getJsonOpt(div, this.getDivAttrs().DRAW_OPTS) || {});
        }
        return res;
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
     * For a given div, set the value of an option.
     * @param {Element} div
     * @param {string}  opt HTML tag name holding the option value
     * @param {boolean} value
     */
    setDivOpt: function(div, opt, value) {
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
            if (molDraw) {
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
     * Request mol pickle for a given divId.
     * @param {string} divId id of the div le molecule belongs to
     * @param {string} molText molecule description (SMILES, molblock or pkl_base64)
     * @param {string} scaffoldText scaffold description (SMILES, molblock or pkl_base64).
     * Note that the description may include multiple scaffolds, either separated by
     * a pipe symbol ('|', SMILES and pkl_base64) or by the SDF terminator ('$$$$', molblock).
     * @param {object} opts rendering options
     * @returns {Promise} a Promise that will resolve to an object
     * containing the mol pickle (and possibly other results depending on
     * the job type), or to null if the job is aborted before being submitted
     */
    getPickledMolAndMatch: async function(divId, molText, scaffoldText, userOpts) {
        const promArray = [];
        let res = null;
        // if the user wants to align to a scaffoldText or highlight
        // the scaffoldText, we need an aligned layout + matches
        if (userOpts.SCAFFOLD_ALIGN || userOpts.SCAFFOLD_HIGHLIGHT) {
            promArray.push(this.requestMolPickle(divId, molText, scaffoldText, userOpts));
        }
        // if the user does not want to align to a scaffoldText, we
        // need an unaligned layout
        if (!userOpts.SCAFFOLD_ALIGN) {
            promArray.push(this.requestMolPickle(divId, molText, null, {
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
            res = {
                match: firstRes.match,
                rebuild: firstRes.rebuild,
                // the pickle will always be from the last promise
                pickle: lastRes.pickle,
            };
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
        const { width, height } = this.getRoundedDivSize(div);
        // get a spinner wheel with a radius appropriate
        // to the size of div
        const spinner = this.getSpinner(div);
        let molblock = '';
        const _asyncDraw = async (tid) => {
            // get the HTML element where we are going to draw
            const molDraw = this.getMolDraw(div);
            const userOpts = this.getUserOptsForDiv(div);
            const drawOpts = this.getDrawOpts(div);
            if (typeof userOpts.USE_MOLBLOCK_WEDGING === 'undefined'
                || userOpts.USE_MOLBLOCK_WEDGING) {
                Object.assign(drawOpts, {
                    useMolBlockWedging: true,
                    wedgeBonds: false,
                    addChiralHs: false,
                });
            }
            drawOpts.addAtomIndices = userOpts.ATOM_IDX;
            drawOpts.width = width;
            drawOpts.height = height;
            const key = this.getCacheKey(div);
            let res = this.getCurrentMol(key);
            const scaffoldText = this.getScaffold(div);
            const divId = this.getDivId(div);
            if (!res) {
                const molText = this.getMol(div);
                res = await this.getPickledMolAndMatch(divId, molText, scaffoldText, { drawOpts, ...userOpts }) || {};
            }
            const { pickle, match, rebuild } = res;
            if (pickle) {
                this.setCurrentMol(key, pickle, match);
                if (userOpts.SCAFFOLD_ALIGN || userOpts.SCAFFOLD_HIGHLIGHT) {
                    if (!match && scaffoldText) {
                        this.setFailsMatch(key, scaffoldText);
                    } else {
                        this.clearFailsMatch(key);
                    }
                }
                if (rebuild) {
                    this.setWasRebuilt(key);
                } else {
                    this.clearWasRebuilt(key);
                }
                if (userOpts.SCAFFOLD_HIGHLIGHT && match) {
                    Object.assign(drawOpts, match);
                } else if (!userOpts.SCAFFOLD_HIGHLIGHT) {
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
                    const mol = await this.getMolFromPickle(pickle);
                    if (mol) {
                        try {
                            if (returnMolBlock) {
                                const molBlockParams = this.getMolblockParams(userOpts.USE_MOLBLOCK_WEDGING);
                                molblock = getMolblockFromMol(mol, molBlockParams);
                            }
                            if (!useSvg) {
                                if (userOpts.ABBREVIATE) {
                                    mol.condense_abbreviations();
                                }
                                this.write2DLayout(mol, drawOpts, molDraw);
                            }
                        } catch(e) {
                            console.error(`Failed to draw to div`);
                        } finally {
                            mol.delete();
                        }
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
     * @param {string} type either 'copy' or 'cog'
     * @param {Element} div
     * @returns {function} either the copyAction or cogAction function
     */
    onButtonAction: function(e, type, div) {
        e.stopPropagation();
        return this[type + 'Action'](div);
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
            this.logClipboardError(`Failed to write content`);
            res = false;
        }
        return res;
    },

    /**
     * Returns a { molblock, smiles, inchi } dictionary
     * containing the respective chemical representations
     * associated to a given mol pickle.
     * @param {UInt8Array} pickle
     * @param {Array} formats optional, array with formats that
     * should be retrieved ('molblock', 'smiles', 'inchi')
     * @param {boolean} useMolBlockWedging whether the molblock should
     * be generated using original CTAB wedging information
     * @returns {object} dictionary with chemical representations
     */
    getChemFormatsFromPickle: async function(pickle, formats, useMolBlockWedging) {
        formats = formats || ['molblock', 'smiles', 'inchi'];
        const molBlockParams = this.getMolblockParams(useMolBlockWedging);
        const res = Object.fromEntries(formats.map(k => [k, '']));
        const mol = await this.getMolFromPickle(pickle);
        if (mol) {
            if (res.molblock === '') {
                res.molblock = getMolblockFromMol(mol, molBlockParams);
            }
            if (res.smiles === '') {
                try {
                    res.smiles = mol.get_smiles();
                } catch(e) {
                    console.error(`Failed to generate SMILES (${e})`);
                }
            }
            if (res.inchi === '') {
                try {
                    res.inchi = mol.get_inchi();
                } catch(e) {
                    console.error(`Failed to generate InChI (${e})`);
                }
            }
            mol.delete();
        }
        return res;
    },

    /**
     * Returns a JSMol from the passed pickle
     * IMPORTANT: it is responsibility of the caller to call
     * delete() on the returned JSMol when done with it to
     * avoid leaking memory, as the garbage collector will NOT
     * automatically free memory allocated by the WASM library.
     * @param {UInt8Array} pickle
     * @returns {JSMol|null} RDKitJS molecule
     */
    getMolFromPickle: async function(pickle) {
        // block until rdkitModule is ready
        const rdkitModule = await this.getRDKitModule();
        return getMolFromUInt8Array(rdkitModule, pickle);
    },

    /**
     * Returns a dictionary with the molecule and the scaffold
     * match (if any) associated to the passed key.
     * IMPORTANT: it is responsibility of the caller to call
     * delete() on the returned JSMol when done with it to
     * avoid leaking memory, as the garbage collector will NOT
     * automatically free memory allocated by the WASM library.
     * @param {string} key cache key
     * @returns {object|null} { mol: JSMol, match: object } dictionary
     */
    getMolAndMatchForKey: async function(key) {
        const currentMol = this.getCurrentMol(key);
        let res = null;
        if (currentMol) {
            const { pickle, match } = currentMol;
            res = {
                mol: await this.getMolFromPickle(pickle),
                match,
            };
        }
        return res;
    },

    /**
     * Returns the first divId (if there are multiple) associated
     * to the passed key. If the passed key is actually corresponding
     * to a divId, it will be returned unchanged.
     * @param {string} divIdOrKey cache key or divId
     * @returns {string} divId
     */
    getFirstDivIdFromDivIdOrKey: function(divIdOrKey) {
        let firstDivId = this.currentDivs().has(divIdOrKey) ? divIdOrKey : null;
        if (!firstDivId) {
            // note that an id may correspond to multiple divIds.
            // we will pick the first that matches our id
            for (const divId of this.currentDivs().keys()) {
                if (divId.endsWith(this.getDivIdSeparator() + divIdOrKey)) {
                    firstDivId = divId;
                    break;
                }
            }
        }
        return firstDivId;
    },

    /**
     * Returns the array of all divIds (if there are multiple) associated
     * to the passed key. If the passed key is actually corresponding
     * to a divId, a single-element array with the passed divId will be
     * returned.
     * @param {string} divIdOrKey cache key or divId
     * @returns {Array<string>} array of divIds
     */
    getDivIdArrayFromDivIdOrKey: function(divIdOrKey) {
        let divIdArray = this.currentDivs().has(divIdOrKey) ? [divIdOrKey] : null;
        if (!divIdArray) {
            divIdArray = [];
            for (const divId of this.currentDivs().keys()) {
                if (divId.endsWith(this.getDivIdSeparator() + divIdOrKey)) {
                    divIdArray.push(divId);
                }
            }
        }
        return divIdArray;
    },

    /**
     * Get an image with the 2D structure associated to the passed divId.
     * If a key is passed, the image from the first divId associated to
     * that key is returned.
     * @param {string} divIdOrKey cache key or divId
     * @param {object} opts optional dictionary with drawing options;
     * see getImageFromMol for details
     * @returns {string|Blob} a string if format is 'svg' or a Blob if 'png'
     */
    getImageFromDivIdOrKey: async function(divIdOrKey, opts) {
        let res = null;
        const divId = this.getFirstDivIdFromDivIdOrKey(divIdOrKey);
        const key = this.getCacheKey(divId || divIdOrKey);
        const { mol, match } = await this.getMolAndMatchForKey(key) || {};
        if (mol) {
            try {
                const optsCopy = { ...opts };
                optsCopy.match =  optsCopy.match || match;
                let userOpts = {};
                let drawOpts;
                const div = this.getMolDiv(divId);
                userOpts = this.getUserOptsForDiv(div || divId) || {};
                drawOpts = this.getDrawOpts(div || divId);
                optsCopy.userOpts = { ...userOpts, ...optsCopy.userOpts };
                optsCopy.drawOpts = { ...drawOpts, ...optsCopy.drawOpts };
                res = this.getImageFromMol(mol, optsCopy);
            } catch(e) {
                console.error(`Failed to get image for ${divId} (${e})`);
            } finally {
                mol.delete();
            }
        }
        return res;
    },

    /**
     * Get an image with the 2D structure associated to the passed JSMol.
     * @param {JSMol} mol RDKitJS molecule
     * @param {object} opts optional dictionary with drawing options:
     * - format: 'png', 'base64png' or 'svg', defaults to 'png'
     * - transparent: transparent background, defaults to true
     * - width: image width, defaults to the current div width (if any)
     * - height: image height, defaults to the current div height (if any)
     * - scaleFac: image scale factor, defaults to the current scale factor
     * - match: match object, defaults to the current div match
     * - userOpts: user settings, defaults to the current div settings
     * - drawOpts: RDKit drawOpts, defaults to the current div drawOpts
     * @returns {string|Blob} a string if format is either 'svg' or 'base64png',
     * otherwise a Blob
     */
    getImageFromMol: async function(mol, opts) {
        if (!mol) {
            return null;
        }
        let {
            width,
            height,
            scaleFac,
            format,
            match,
            transparent,
            userOpts,
            drawOpts
        } = opts;
        let image = null;
        width = width || DEFAULT_IMG_OPTS.width;
        height = height || DEFAULT_IMG_OPTS.height;
        scaleFac = scaleFac || this.copyImgScaleFac || DEFAULT_IMG_OPTS.scaleFac;
        match = match || {};
        transparent = transparent || typeof transparent === 'undefined';
        userOpts = userOpts || {};
        drawOpts = { ...this.getDefaultDrawOpts(), ...(drawOpts || {}) };
        const isSvg = (format === 'svg');
        const isBase64Png = (format === 'base64png');
        if (userOpts.ABBREVIATE) {
            mol.condense_abbreviations();
        }
        if (userOpts.SCAFFOLD_HIGHLIGHT) {
            Object.assign(drawOpts, match);
        } else {
            delete drawOpts.atoms;
            delete drawOpts.bonds;
        }
        drawOpts.addAtomIndices = userOpts.ATOM_IDX || false;
        drawOpts.fixedBondLength *= scaleFac;
        drawOpts.width = Math.round(width) * scaleFac;
        drawOpts.height = Math.round(height) * scaleFac;
        drawOpts.backgroundColour = drawOpts.backgroundColour || [1, 1, 1, 1];
        if (transparent) {
            drawOpts.backgroundColour[3] = 0;
        }
        if (isSvg) {
            try {
                image = this.write2DLayout(mol, drawOpts);
            } catch(e) {
                console.error(`Failed to generate SVG image (${e})`);
            }
        } else if (haveWindow) {
            const canvas = document.createElement('canvas');
            this.resizeMolDraw(canvas, drawOpts.width, drawOpts.height, 1);
            try {
                if (this.write2DLayout(mol, drawOpts, canvas) !== null) {
                    image = isBase64Png ? canvas.toDataURL() :
                        await new Promise(resolve => canvas.toBlob(image => resolve(image)));
                    if (!image) {
                        console.error(`Failed to generate PNG image`);
                    }
                }
            } catch(e) {
                console.error(`Failed to draw to canvas (${e})`);
            }
        } else {
            console.error("Canvas is not available on this platform");
        }
        return image;
    },

    /**
     * Generate appropriate JSON parameters for get_molblock()
     * based on the value of the useMolBlockWedging parameter.
     * @param {string|boolean} useMolBlockWedging can be a boolean or 'a'
     * @returns {string} get_molblock parameters as JSON string
     */
    getMolblockParams: function(useMolBlockWedging) {
        useMolBlockWedging = (typeof useMolBlockWedging === 'boolean'
            ? useMolBlockWedging : true);
        const addChiralHs = !useMolBlockWedging;
        return JSON.stringify({ useMolBlockWedging, addChiralHs });
    },

    /**
     * Put some content from a given div on the clipboard.
     * @param {Element} div
     * @param {Array<String>} formats array of formats
     * to be copied to clipboard ('png', 'svg', 'molblock')
     */
    putClipboardItem: async function(div, formats) {
        let molMatch = {};
        this.setButtonsEnabled(div, false);
        try {
            const drawOpts = this.getDrawOpts(div);
            const userOpts = this.getUserOptsForDiv(div);
            const key = this.getCacheKey(div);
            molMatch = await this.getMolAndMatchForKey(key) || {};
            const { mol, match } = molMatch;
            if (!mol) {
                this.logClipboardError();
            } else {
                const hasPng = formats.includes('png');
                const hasSvg = formats.includes('svg');
                const content = {};
                if (formats.includes('molblock')) {
                    const type = 'text/plain';
                    const molBlockParams = this.getMolblockParams(userOpts.USE_MOLBLOCK_WEDGING);
                    const molblock = getMolblockFromMol(mol, molBlockParams);
                    content[type] = new Blob([molblock], { type });
                }
                if (hasPng || hasSvg) {
                    const { width, height } = this.getRoundedDivSize(div);
                    const opts = {
                        width,
                        height,
                        // if both svg and png were specified, png is ignored
                        format: (hasSvg ? 'svg' : 'png'),
                        match,
                        drawOpts,
                        userOpts,
                    };
                    const image = this.getImageFromMol(mol, opts);
                    if (!image) {
                        this.logClipboardError();
                    } else {
                        if (hasSvg) {
                            // at the moment svg+xml MIME type is not supported by browsers
                            // so we copy as plain text. This means SVG text will clobber molblock
                            if (typeof image === 'string') {
                                const type = 'text/plain';
                                content[type] = new Blob([image], { type });
                            }
                        } else {
                            content['image/png'] = image;
                        }
                    }
                }
                if (Object.keys(content).length) {
                    await this.putClipboardContent(content);
                }
            }
        } catch(e) {
            this.logClipboardError(`${e}`);
        } finally {
            molMatch.mol && molMatch.mol.delete();
            this.setButtonsEnabled(div, true);
        }
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
        const tooltip = this.getTooltip('cog');
        if (tooltip && tooltip.isVisible()) {
            tooltip.hide();
        }
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
     * @param {string} type either 'copy' or 'cog'
     * @returns {Element} HTML button element
     */
    createButton: function(type) {
        this.buttons = this.buttons || {};
        if (!this.buttons[type]) {
            const div = document.createElement('div');
            div.className = 'button-container';
            const button = document.createElement('button');
            button.className = `button ${type}`;
            button.name = `${type}-button`;
            button.type = 'button';
            const icon = this.getButtonIcon(type);
            button.appendChild(icon);
            div.appendChild(button);
            this.buttons[type] = div;
        }
        return this.buttons[type].cloneNode(true);
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
        if (!this._spinner) {
            const spinner = document.createElement('div');
            spinner.className = this.getRdkStrRnrPrefix() + 'spinner';
            const spinnerWhl = document.createElement('div');
            spinnerWhl.className = 'whl';
            spinner.appendChild(spinnerWhl);
            this._spinner = spinner;
        }
        const spinner = this._spinner.cloneNode(true);
        const { height } = this.getRoundedDivSize(div);
        this.setSpinnerWhlRadius(spinner, height)
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
     * Returns a dictionary with width and height
     * associated to the passed div as rounded integers.
     * If the data-width and data-height attributes are not present or 0,
     * the current div rect width and height are returned.
     * If also the current div rect width or height are zero, a default
     * value will be used.
     * @param {Element} div
     * @returns {object} { width: integer, height: integer } dictionary
     */
    getRoundedDivSize: function(div) {
        const divRect = div.getBoundingClientRect();
        const width = parseInt(div.getAttribute(dataAttr(this.getDivAttrs().WIDTH)) || '0')
            || Math.round(divRect.width) || DEFAULT_IMG_OPTS.width;
        const height = parseInt(div.getAttribute(dataAttr(this.getDivAttrs().HEIGHT)) || '0')
            || Math.round(divRect.height) || DEFAULT_IMG_OPTS.height;
        return { width, height };
    },

    /**
     * Resize the passed molDraw HTML Element to the passed width and height.
     * @param {Element} molDraw HTML Element (either canvas or SVG div)
     * @returns {object} { width: integer, height: integer } dictionary
     */
    resizeMolDraw: function(molDraw, width, height, scaleFac) {
        const scale = scaleFac || _window.devicePixelRatio;
        if (!(width > 0 && height > 0)) {
            return;
        }
        if (molDraw.nodeName === 'CANVAS') {
            molDraw.width = width * scale;
            molDraw.height = height * scale;
            const ctx = molDraw.getContext('2d');
            ctx && ctx.scale(scale, scale);
        }
        molDraw.setAttribute('style', `width: ${width}px; height: ${height}px;`);
    },

    /**
     * Creates an SVG div if it does not yet exist and
     * returns a copy of size appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} SVG div
     */
    createSvgDiv: function(div) {
        if (!this._svgDiv) {
            const svgDiv = document.createElement('div');
            svgDiv.setAttribute('name', 'mol-draw');
            svgDiv.className = this.getRdkStrRnrPrefix() + 'mol-draw';
            svgDiv.appendChild(document.createTextNode(' '));
            this._svgDiv = svgDiv;
        }
        const svgDiv = this._svgDiv.cloneNode(true);
        const { width, height } = this.getRoundedDivSize(div);
        this.resizeMolDraw(svgDiv, width, height);
        return svgDiv;
    },

    /**
     * Creates a canvas element if it does not yet exist and
     * returns a copy of size appropriate to the container div.
     * @param {Element} div container div
     * @returns {Element} canvas
     */
    createCanvas: function(div) {
        if (!this._canvas) {
            const canvas = document.createElement('canvas');
            canvas.setAttribute('name', 'mol-draw');
            this._canvas = canvas;
        }
        const canvas = this._canvas.cloneNode(true);
        const { width, height } = this.getRoundedDivSize(div);
        this.resizeMolDraw(canvas, width, height);
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
            this._userTags = Object.values(this.getAvailUserOpts()).map(item => item.tag);
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
     * Update the cache of user-defined options for a given key.
     * If the value of the option is a boolean and is the same
     * as the default value for that option, the key for that option
     * is removed from the cache. If no keys are left, the whole entry
     * for that div is removed.
     * Note that the div is identified by a key computed by getCacheKey().
     * @param {string} key cache key
     * @param {string} userOpt name of the user-defined option
     * @param {boolean|string|null} value value to be stored
     */
    updateUserOptCache: function(key, userOpt, value) {
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
     * for a given key.
     * If the cached value does not exist, returns undefined
     * @param {string} key cache key
     * @param {string} userOpt name of the user-defined option
     * @returns {boolean|string} cached value, or undefined if there
     * is no value associated to userOpt in the cache
     *
     */
    getCachedValue: function(key, userOpt) {
        const cachedEntry = this.userOptCache[key];
        let cachedValue;
        if (cachedEntry) {
            cachedValue = cachedEntry[userOpt];
        }
        return cachedValue;
    },

    /**
     * Get the value of a user-defined option from cache for a given div
     * or divId. If the value can be converted to a boolean, the value
     * is returned as a boolean, otherwise the value is returned as
     * a string. If no value is found, undefined is returned.
     * Note that the div is identified by a key computed by getCacheKey().
     * If no cached value exists, the value read from the div is returned.
     * If the div has no value, or a divId is passed, undefined is returned.
     * @param {Element|string} div div or divId
     * @param {string} userOpt name of the user-defined option
     * @returns {any} value if the value was found, undefined if the value
     * was not found
     */
    getDivOpt: function(div, userOpt) {
        const key = this.getCacheKey(div);
        let res = this.getCachedValue(key, userOpt);
        if (typeof res === 'undefined' && typeof div !== 'string') {
            res = div.getAttribute(dataAttr(userOpt));
        }
        return this.toBool(res);
    },

    /**
     * Convert HTML attribute to bool if possible.
     * @param {string|null} v HTML value obtained calling Element.getAttribute
     * @returns true or false if v can be converted to boolean, otherwise v
     * as a string, or undefined if v is null
     */
     toBool: (v) => {
        let res;
        if (typeof v === 'boolean') {
            return v;
        }
        if (typeof v === 'string') {
            const c = v.substring(0, 1).toLowerCase();
            if (c && 'fn'.includes(c)) {
                res = false;
            } else if (!c || 'ty'.includes(c)) {
                res = true;
            } else {
                res = v;
            }
        }
        return res;
    },

    /**
     * Returns true if the given key was previously found
     * not to match the given scaffold definition.
     * @param {stringh} key cache key
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     * @returns {boolean} true if the given key was previously
     * found not to match this scaffold, false if not
     */
    getFailsMatch: function(key, scaffold) {
        return (scaffold && this.getCachedValue(key, NO_MATCH) === scaffold);
    },

    /**
     * Mark the given key as failing to match the given
     * scaffold definition.
     * @param {string} key cache key
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     */
    setFailsMatch: function(key, scaffold) {
        this.updateUserOptCache(key, NO_MATCH, scaffold);
    },

    /**
     * Clear the 'fails scaffold match' flag on the given key.
     * @param {string} key cache key
     */
    clearFailsMatch: function(key) {
        this.updateUserOptCache(key, NO_MATCH, null);
    },

    /**
     * Returns true if the given key had to undergo coordinate
     * generation ahead of scaffold alignment (e.g., because
     * existing coordinates were corrupted or non-existing).
     * @param {string} key cache key
     * @returns {boolean} true if the given key had to undergo
     * coordinate generation ahead of alignment, false if not
     */
    getWasRebuilt: function(key) {
        return this.getCachedValue(key, WAS_REBUILT);
    },

    /**
     * Mark the given key as having had its coordinate rebuilt
     * ahead of scaffold alignment.
     * @param {string} key cache key
     * @param {string} scaffold scaffold definition (SMILES or CTAB)
     */
    setWasRebuilt: function(key) {
        this.updateUserOptCache(key, WAS_REBUILT, true);
    },

    /**
     * Clear the 'was rebuilt' flag on the given key.
     * @param {string} key cache key
     */
    clearWasRebuilt: function(key) {
        this.updateUserOptCache(key, WAS_REBUILT, null);
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
        const key = this.getCacheKey(divId);
        this.decRef(key);
    },

    /**
     * Called to get the tooltip of the requested type.
     * If text is provided and the tooltip does not exist,
     * it will be created.
     * @param {string} type tooltip type ('copy' or 'cog')
     * @param {string} text tooltip text
     * @returns {object} ButtonTooltip instance
     */
    getTooltip: function(type, text) {
        if (!this._tooltips) {
            this._tooltips = {};
        }
        if (text && !this._tooltips[type]) {
            this._tooltips[type] = new ButtonTooltip(this, text);
        }
        return this._tooltips[type];
    },

    /**
     * Called to show/hide the button tooltip.
     * @param {string} type tooltip type ('copy' or 'cog')
     * @param {string} text tooltip text
     * @param {object} e event
     */
    showHideTooltip: function(e, type, text) {
        const tooltip = this.getTooltip(type, text);
        if (e.type === 'mouseleave' && tooltip.isVisible()) {
            tooltip.hide();
        } else if (e.type === 'mouseenter' && e.target.firstChild && !tooltip.isVisible()) {
            tooltip.show(e.target.firstChild);
        }
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
     * @param {string} divId
     * @param {function} userOptsCallback optional callback
     */
    updateMolDrawDiv: function(divId, userOptsCallback) {
        const div = this.getMolDiv(divId);
        if (!div) {
            return;
        }
        const key = this.getCacheKey(divId);
        this.setRendererCss();
        this.getSpinner(div);
        this.clearCurrentMol(key);
        const divAttrs = Object.fromEntries(this.allTags().map(tag =>
            [tag, div.getAttribute(dataAttr(tag))]));
        let molDraw = this.getMolDraw(div);
        const { width, height } = this.getRoundedDivSize(div);
        if (width > 0 && height > 0) {
            const { WIDTH, HEIGHT } = this.getDivAttrs();
            divAttrs[WIDTH] = width;
            divAttrs[HEIGHT] = height;
            if (molDraw) {
                this.resizeMolDraw(molDraw, width, height);
            }
        }
        divAttrs.userOptsCallback = userOptsCallback;
        this.currentDivs().set(divId, divAttrs);
        this.getButtonTypes().forEach(({ type, tooltip }) => {
            let button = this.getButton(div, type);
            const shouldHide = this.toBool(divAttrs[`hide-${type}`]);
            if (!shouldHide && !button) {
                button = this.createButton(type);
                if (tooltip) {
                    button.onmouseenter = (e) => {
                        if (!(this.settings?.isVisible &&
                            divId === this.settings.currentDivId &&
                            e?.target?.firstChild?.className.includes('cog'))) {
                            this.showHideTooltip(e, type, tooltip);
                        }
                    }
                    button.onmouseleave = (e) => {
                        this.showHideTooltip(e, type, tooltip);
                    }
                }
                button.onclick = (e) => {
                    this.onButtonAction(e, type, div);
                    button.onmouseleave && button.onmouseleave(e);
                };
                div.insertBefore(button, molDraw);
            } else if (shouldHide && button) {
                button.remove();
            }
        });
        const useSvg = this.toBool(divAttrs[this.getDivAttrs().USE_SVG]);
        if (molDraw) {
            const isSvg = (molDraw.nodeName === 'DIV');
            if (isSvg ^ useSvg) {
                molDraw.remove();
                molDraw = null;
            }
        }
        if (!molDraw) {
            div.appendChild(useSvg ? this.createSvgDiv(div) : this.createCanvas(div));
            if (width && !div.style.width) {
                div.style.width = `${width}px`;
            }
            if (height && !div.style.height) {
                div.style.height = `${height}px`;
            }
        }
        this.draw(div);
        if (this.settings?.isVisible && divId === this.settings.currentDivId) {
            this.hideSettings();
        }
    },

    /**
     * For a given div, it will check if the div needs to be updated
     * @param {Element|string} divOrDivId div or divId
     * @returns {boolean} whether the div needs to be updated
     */
    shouldDraw: function(divOrDivId) {
        let shouldDraw = false;
        let div;
        let divId;
        if (typeof divOrDivId === 'object') {
            div = divOrDivId;
            divId = div.id;
        } else {
            divId = divOrDivId;
            div = this.getMolDiv(divId);
        }
        if (!div) {
            return shouldDraw;
        }
        let currentDivValue;
        if (!shouldDraw) {
            // if this divId has not been seen before, it needs to
            // be drawn
            currentDivValue = this.currentDivs().get(divId);
            if (!currentDivValue) {
                const key = this.getCacheKey(divId);
                this.incRef(key);
                shouldDraw = true;
            }
        }
        // if it was seen before, we may still need to redraw
        // if some attribute changed
        if (!shouldDraw) {
            const { width, height } = this.getRoundedDivSize(div);
            const areWidthHeightNonZero = (width > 0 && height > 0);
            const currentWidth = parseInt(currentDivValue.width || '0');
            const currentHeight = parseInt(currentDivValue.height || '0');
            if (!areWidthHeightNonZero || currentWidth != width || currentHeight != height) {
                shouldDraw = true;
                this.setSpinnerWhlRadius(this.getSpinner(div), height);
                this.getMolDraw(div).innerHTML = '';
            }
        }
        if (!shouldDraw) {
            const widthHeightTags = [this.getDivAttrs().WIDTH, this.getDivAttrs().HEIGHT];
            shouldDraw = this.allTags().some(tag => {
                if (widthHeightTags.includes(tag)) {
                    return false;
                }
                const divAttrValue = div.getAttribute(dataAttr(tag));
                const currentDivAttrValue = currentDivValue[tag];
                return (typeof currentDivAttrValue !== 'undefined' && divAttrValue !== currentDivAttrValue);
            });
        }
        return shouldDraw;
    },

    /**
     * For a given div, it will check if the div needs to be updated
     * and will do so if needed.
     * @param {string} divId
     * @param {function} userOptsCallback optional callback
     * @returns {boolean} whether the div was updated
     */
    updateMolDrawDivIfNeeded: function(divId, userOptsCallback) {
        // if a redraw is needed, update
        const res = this.shouldDraw(divId);
        if (res) {
            this.updateMolDrawDiv(divId, userOptsCallback);
        }
        return res;
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
    copyImgScaleFac: DEFAULT_IMG_OPTS.scaleFac,
};

export default Renderer;
