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

import { RDK_STR_RNR } from './constants';
import ButtonTooltip from './ButtonTooltip';
import { getElementCenter, getViewPortRect } from './utils';

/**
 * SettingsDialog class:
 * Creates a dialog that allows the user to:
 * - customize the appearance of a molecule
 * - copy the molecule to the clipboard in different formats
 */
class SettingsDialog {
    /**
     * Constructor.
     * @param  {RDKitStructureRenderer} renderer
     * @param  {string} html  HTML code for the dialog
     */
    constructor(renderer) {
        this.renderer = renderer;
        this._createDialog();
        this.currentDivId = null;
    }

    /**
     * Parse the dash-separated id tag and extract the
     * last substring.
     * @param {string} id id tag
     * @returns {string} substring
     */
    getIdVariant(id) {
        const arr = id.split('-');
        return (arr.length ? arr[arr.length - 1] : '');
    }

    /**
     * Called when a molecule is to be copied to clipboard
     * as a PNG image.
     */
    async onCopyPNG() {
        await this.renderer.putClipboardItem(this.molDiv, ['png']);
    }

    /**
     * Called when a molecule is to be copied to clipboard
     * as an SVG image.
     */
    async onCopySVG() {
        await this.renderer.putClipboardItem(this.molDiv, ['svg']);
    }

    /**
     * Called when a molecule is to be copied to clipboard
     * as SMILES, CTAB, InChI, PNG, SVG, depending on the value of
     * the field parameter.
     * @param {string} field format the molecule should be copied
     */
    async onCopy(field) {
        if (!await this.renderer.canAccessClipboard()) {
            return;
        }
        const copyFormat = this.copyFormat[field];
        this.renderer.setButtonEnabled(copyFormat, false);
        let item;
        // if there is an onCopyXXX function specific for format XXX,
        // call it, otherwise copy text from the respective TextArea
        const onCopyFunc = this[`onCopy${field.toUpperCase()}`];
        if (onCopyFunc) {
            await onCopyFunc.call(this);
        } else {
            const molText = this.textArea[field].value;
            const text = new Blob([molText], { type: 'text/plain' });
            // eslint-disable-next-line no-undef
            item = new ClipboardItem({
                'text/plain': text,
            });
            try {
                await navigator.clipboard.write([item]);
            } catch {
                this.renderer.logClipboardError('write content');
            }
        }
        this.renderer.setButtonEnabled(copyFormat, true);
    }

    /**
     * Fetch the checked status of the checkbox field
     * and store it in the cache.
     * @param {string} field tag identifying the checkbox
     * @returns {boolean} whether the checkbox is checked
     */
    fetchAndStoreBoolOpt(field) {
        const isChecked = this.renderOpt[field].checked;
        // remember the user setting for this field/div
        const key = this.renderer.getCacheKey(this.molDiv);
        this.renderer.updateUserOptCache(key, field, isChecked);
        return isChecked;
    }

    /**
     * Called to enable/disable the possibility to copy
     * the molecule as CTAB, PNG and SVG. While copy is disabled the
     * molblock TextArea is replaced by a spinning wheel.
     * @param {boolean} shouldEnable whether copy should be enabled
     */
    enableCopyMolblock(shouldEnable) {
        const displaySpinner = shouldEnable ? 'none' : 'block';
        if (!shouldEnable) {
            this.coordDependentCopyButtons.forEach(
                (field) => this.renderer.setButtonEnabled(this.copyFormat[field], false, true)
            );
            this.molblockSpinner.innerDiv = this.renderer.getSpinner(this.molblockSpinner.div);
            const wasExpanded = this.isExpanded.checked;
            this.isExpanded.checked = true;
            const molblockRect = this.textArea.molblock.getBoundingClientRect();
            this.isExpanded.checked = wasExpanded;
            const height = Math.round(molblockRect.height);
            const width = Math.round(molblockRect.width);
            this.textArea.molblock.style.opacity = '0';
            this.renderer.setSpinnerWhlRadius(this.molblockSpinner.innerDiv, height, width);
            this.molblockSpinner.tid = setTimeout(() => {
                this.molblockSpinner.div.style.display = displaySpinner;
                if (this.molblockSpinner.innerDiv) {
                    this.molblockSpinner.innerDiv.style.display = displaySpinner;
                }
            }, this.renderer.getWhlOpts().TIMEOUT);
        } else if (this.molblockSpinner.innerDiv) {
            if (this.molblockSpinner.tid) {
                clearTimeout(this.molblockSpinner.tid);
                this.molblockSpinner.tid = null;
            }
            const divId = this.renderer.getDivId(this.molDiv);
            const currentDiv = this.renderer.currentDivs().get(divId);
            if (this.currentDivId !== divId || !currentDiv?.childQueue) {
                this.textArea.molblock.style.opacity = '1';
                this.molblockSpinner.div.style.display = displaySpinner;
                this.molblockSpinner.innerDiv.style.display = displaySpinner;
                this.molblockSpinner.innerDiv.remove();
                this.molblockSpinner.innerDiv = null;
                this.coordDependentCopyButtons.forEach(
                    (field) => this.renderer.setButtonEnabled(this.copyFormat[field], true, true)
                );
            }
        }
    }

    /**
     * Called when the user clicks on one of the
     * SettingsDialog checkboxes.
     * @param {string} field the tag identifying the checkbox
     */
    async onRenderingChanged(field) {
        const div = this.molDiv;
        const divId = this.renderer.getDivId(div);
        const key = this.renderer.getCacheKey(div);
        const currentDiv = this.renderer.currentDivs().get(divId) || {};
        const isChecked = this.fetchAndStoreBoolOpt(field);
        const userOpts = this.renderer.getAvailUserOpts();
        let func = () => null;
        if (field === userOpts.SCAFFOLD_ALIGN.tag || field === userOpts.RECOMPUTE2D.tag) {
            func = this.enableCopyMolblock.bind(this);
        }
        // while the 2D layout is being recomputed, disable
        // the possibility to copy the molecule to clipboard
        // as molblock
        func(false);
        let molblock = '';
        try {
            // if there is no assigned ChildQueue yet for this divId,
            // assign one
            if (!currentDiv.childQueue) {
                currentDiv.childQueue = this.renderer.scheduler().mainQueue.addChild(divId);
            }
            this.renderer.clearCurrentMol(key);
            molblock = await this.renderer.draw(div, true);
            this.enableScaffoldOpts(div);
            // call the callback (if any) to signal
            // the upstream app that the user settings for this div have changed
            if (molblock) {
                const { userOptsCallback } = currentDiv;
                if (userOptsCallback) {
                    userOptsCallback(divId, field, isChecked, molblock);
                }
            }
        } finally {
            func(true);
        }
        // update the molblock TextArea with the new coords
        if (div === this.molDiv && molblock !== null && molblock !== this.textArea.molblock.value) {
            this.textArea.molblock.value = molblock;
        }
    }

    /**
     * Called to show/hide the scaffold tooltip.
     * @param {object} e event
     */
    showHideScaffoldTooltip(e) {
        const { scaffoldTooltip } = this;
        if (e.type === 'mouseleave' && scaffoldTooltip.isVisible()) {
            scaffoldTooltip.hide();
        } else if (e.type === 'mouseenter' && e.target && !scaffoldTooltip.isVisible()) {
            scaffoldTooltip.show(e.target, {
                x: -0.3 * e.target.getBoundingClientRect().width,
                y: 0,
            });
        }
    }

    /**
     * Create the dialog (called by the constructor).
     */
    _createDialog() {
        this.dialogOuter = document.createElement('div');
        this.dialogOuter.style.position = 'relative';
        this.dialogOuter.innerHTML = this.renderer.getDialogHtml();
        this.dialog = this.dialogOuter.firstElementChild;
        this.coordDependentCopyButtons = ['molblock', 'png', 'svg'];
        const formats = this.dialog.querySelector(`div[class=${RDK_STR_RNR}formats]`);
        this.renderOpt = {};
        // dynamically create a checkbox and the relative label
        // for each user setting in USER_OPTS
        this.renderer.getCheckableUserOpts().forEach(({ tag, text }) => {
            const label = document.createElement('label');
            label.className = `${RDK_STR_RNR}checkbox`;
            label.appendChild(document.createTextNode(text));
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `${RDK_STR_RNR}checkbox-${tag}`;
            checkbox.onclick = () => this.onRenderingChanged(tag);
            this.renderOpt[tag] = checkbox;
            label.appendChild(checkbox);
            if (text.includes('scaffold')) {
                label.onmouseenter = (e) => {
                    this.showHideScaffoldTooltip(e);
                };
                label.onmouseleave = (e) => {
                    this.showHideScaffoldTooltip(e);
                };
            }
            this.scaffoldTooltip = new ButtonTooltip(this.renderer);
            ['box', 'mark'].forEach((className) => {
                const span = document.createElement('span');
                span.className = className;
                label.appendChild(span);
            });
            this.dialog.insertBefore(label, formats);
        });
        this.isExpanded = this.dialog.querySelector(`input[id=${RDK_STR_RNR}formats-input]`);
        this.onCopy = this.onCopy.bind(this);
        this.setPosition = this.setPosition.bind(this);
        this.hideOnClick = this.hideOnClick.bind(this);
        const textArea = Object.fromEntries(Array.from(this.dialog.querySelectorAll(
            `textarea[id^=${RDK_STR_RNR}content-`
        )).map((elem) => [this.getIdVariant(elem.id), elem]));
        const spinnerOuter = document.createElement('div');
        spinnerOuter.className = 'spinner';
        const spinner = document.createElement('div');
        spinner.setAttribute('style', 'position: absolute; display: none;');
        spinnerOuter.appendChild(spinner);
        this.molblockSpinner = { div: spinner };
        const molblockTextArea = textArea.molblock;
        molblockTextArea.parentNode.insertBefore(spinnerOuter, molblockTextArea);
        this.textArea = textArea;
        this.copyFormat = {};
        this.dialog.querySelectorAll(`button[id^=${RDK_STR_RNR}copy-`).forEach(
            (button) => {
                button.appendChild(this.renderer.getButtonIcon('copy'));
                const field = this.getIdVariant(button.id);
                this.copyFormat[field] = button;
                button.onclick = () => this.onCopy(field);
            }
        );
        const scaleInput = this.dialog.querySelector(`input[id^=${RDK_STR_RNR}scalefac`);
        if (scaleInput) {
            scaleInput.onchange = (e) => {
                this.renderer.copyImgScaleFac = e.target.value;
            };
        }
        this.dialog.querySelectorAll(`[id^=${RDK_STR_RNR}formats-]`).forEach(
            (elem) => {
                elem.onclick = () => {
                    this.isExpanded.checked = !this.isExpanded.checked;
                };
            }
        );
    }

    /**
     * Disable (grey out) HTML Element.
     * @param {object} elem HTML Element that is to be disabled
     */
    disableAction(elem) {
        [elem, elem.parentNode].forEach((item) => item.setAttribute('disabled', 'disabled'));
    }

    /**
     * Enable HTML Element.
     * @param {object} elem HTML Element that is to be enabled
     */
    enableAction(elem) {
        [elem, elem.parentNode].forEach((item) => item.removeAttribute('disabled'));
    }

    /**
     * Enable scaffold-related options in the SettingsDialog
     * for a given div. The fact that scaffold alignment/highlighting
     * are enabled depends on:
     * a) the availability of a scaffold definition
     * b) the fact that the scaffold was not previously proven
     *    not to match the molecule associated to div
     * @param {Element} div
     */
    enableScaffoldOpts(div) {
        const userOpts = this.renderer.getAvailUserOpts();
        const drawOpts = this.renderer.getDrawOpts(div);
        const scaffold = this.renderer.getScaffold(div);
        const key = this.renderer.getCacheKey(div);
        const hasScaffold = !!scaffold;
        const failsMatch = hasScaffold && this.renderer.getFailsMatch(key, scaffold);
        const canAlign = hasScaffold && !failsMatch;
        // enable scaffold alignment only if a scaffold definition is available
        // and if that has not failed to match before
        // enable scaffold highlighting only if a scaffold definition is available
        // and if that has not failed to match before, or if drawOpts has a non-empty
        // "atoms" attribute
        const disableAndUncheck = (tag) => {
            let text = null;
            if (hasScaffold && failsMatch) {
                text = 'Scaffold does not match';
            } else if (!hasScaffold) {
                text = 'No scaffold defined';
            }
            this.scaffoldTooltip.setText(text);
            const control = this.renderOpt[tag];
            control.checked = false;
            this.disableAction(control);
        };
        const enableAndMaybeCheck = (tag) => {
            this.scaffoldTooltip.setText(null);
            const control = this.renderOpt[tag];
            if (control.hasAttribute('disabled')) {
                const isChecked = this.renderer.getDivOpt(div, tag) || false;
                control.checked = isChecked;
            }
            this.enableAction(control);
        };
        const alignAction = canAlign ? enableAndMaybeCheck : disableAndUncheck;
        const highlightAction = canAlign
            || (drawOpts.atoms && Array.isArray(drawOpts.atoms) && drawOpts.atoms.length)
            || (drawOpts.bonds && Array.isArray(drawOpts.bonds) && drawOpts.bonds.length)
            ? enableAndMaybeCheck : disableAndUncheck;
        alignAction(userOpts.SCAFFOLD_ALIGN.tag);
        // if the molecule coordinates were rebuilt ahead of the
        // alignment, recompute2D would do nothing, so we disable it
        const shouldAlign = this.renderOpt[userOpts.SCAFFOLD_ALIGN.tag].checked;
        const recompute2DAction = shouldAlign && this.renderer.getWasRebuilt(key)
            ? disableAndUncheck : enableAndMaybeCheck;
        recompute2DAction(userOpts.RECOMPUTE2D.tag);
        highlightAction(userOpts.SCAFFOLD_HIGHLIGHT.tag);
    }

    /**
     * Set the molDiv the SettingsDialog is currently associated with.
     * @param {object} div HTML DIV element
     */
    async setMolDiv(div) {
        this.molDiv = div;
        const key = this.renderer.getCacheKey(div);
        this.renderer.getCheckableUserOpts().forEach(
            (opt) => {
                this.renderOpt[opt.tag].checked = this.renderer.getDivOpt(div, opt.tag) || false;
            }
        );
        this.enableScaffoldOpts(div);
        const relatedNodes = this.renderer.getRelatedNodes(div);
        const dialogRelatives = Object.fromEntries(
            Object.entries(relatedNodes).map(([k, cssSelector]) => {
                let res;
                if (cssSelector) {
                    res = div.closest(cssSelector);
                } else if (cssSelector !== null) {
                    res = null;
                }
                return [k, res];
            })
        );
        if (!dialogRelatives.scrollingNode) {
            dialogRelatives.scrollingNode = document;
        }
        this.dialogRelatives = dialogRelatives;
        this.clickNode = document.body;
        this.buttons = {};
        this.renderer.getButtonTypes().forEach(({ type }) => {
            const button = this.renderer.getButton(div, type);
            if (button) {
                this.buttons[type] = button;
            }
        });
        const userOpts = this.renderer.getUserOptsForDiv(div);
        const formats = await this.renderer.getChemFormatsFromPickle(
            this.renderer.getCurrentMol(key).pickle, null, userOpts);
        Object.entries(formats).forEach(([format, value]) => {
            this.textArea[format].value = value;
        });
    }

    /**
     * Make buttons always visible.
     * @param {object} alwaysVisible if true, buttons are always
     * visible rather than appearing only upon hovering
     */
    setButtonsAlwaysVisible(alwaysVisible) {
        const attr = (alwaysVisible ? ' always-visible' : '');
        Object.entries(this.buttons).forEach(([type, button]) => {
            button.className = `button ${type}${attr}`;
        });
    }

    /**
     * Override to ignore certain HTML elements
     * standing where the cog ought to be.
     * @param {HTMLElement} elem
     * @returns {boolean} whether the passed element
     * should be ignored or not
     */
    // eslint-disable-next-line no-unused-vars
    shouldIgnoreElement(elem) {
        return false;
    }

    /**
     * Called to update the SettingsDialog position.
     * @param {object} e event, when called by an Event handler, or null
     */
    setPosition(e) {
        if (e) {
            // ignore non-scrolling events
            if (e.type !== 'scroll') {
                return;
            }
            // ignore scrolling events from our textareas
            // and do nothing if we are not visible
            if (!this.isVisible
                || (e.target && Object.values(this.textArea).includes(e.target))) {
                return;
            }
        }
        const cogCenter = getElementCenter(this.buttons.cog);
        const dialogRect = this.dialog.getBoundingClientRect();
        if (!this._initialDialogRect) {
            this._initialDialogRect = {
                height: dialogRect.height,
                x: 0,
                y: 0,
            };
            if (!this.dialogRelatives.parentNode) {
                this._initialDialogRect.x = dialogRect.x + window.pageXOffset;
                this._initialDialogRect.y = dialogRect.y + window.pageYOffset;
            }
        }
        if (!this.dialogRelatives.parentNode) {
            let elemAtCogCenter;
            this.buttons.cog.style.display = 'block';
            // temporarily hide the dialog to probe which HTML Element
            // we have in correspondence of the cog center
            this.dialog.style.display = 'none';
            try {
                elemAtCogCenter = document.elementFromPoint(cogCenter.x, cogCenter.y);
            } finally {
                this.dialog.style.display = 'block';
            }
            // if there is an element which is not the HTML document
            // search up the hierarchy until the cog button is found
            // if it is, then the cog button is still visible, otherwise
            // it has gone out of screen and we should hence hide the dialog
            let cogVisible = !!elemAtCogCenter;
            if (cogVisible) {
                if (this.shouldIgnoreElement(elemAtCogCenter)) {
                    return;
                }
                cogVisible = false;
                while (elemAtCogCenter) {
                    if (elemAtCogCenter === this.buttons.cog) {
                        cogVisible = true;
                        break;
                    }
                    elemAtCogCenter = elemAtCogCenter.parentNode;
                }
            }
            if (!cogVisible) {
                this.hide();
                return;
            }
        }
        // if we have been called by a scrolling event handler, check
        // how much the dialog and the cog button have moved since the
        // previous event.
        if (e) {
            const cogDelta = {
                x: cogCenter.x - this.cogCenter.x,
                y: cogCenter.y - this.cogCenter.y,
            };
            const dialogDelta = {
                x: dialogRect.x - this.dialogRect.x,
                y: dialogRect.y - this.dialogRect.y,
            };
            // If they have moved by the same amount (with a 1px
            // tolerance to account for rounding errors), we ignore
            // the scrolling event as the dialog is already scrolling
            // together with the rest of the view and we do not need
            // to do anything
            if (Math.abs(dialogDelta.x - cogDelta.x) < 2
                && Math.abs(dialogDelta.y - cogDelta.y) < 2) {
                return;
            }
        }
        // if this is not a scrolling event, or it is and the dialog
        // has not scrolled as much as the cog button has, compute
        // the dialog position and set it
        const viewPortRect = getViewPortRect();
        const beforeNodeRect = this.dialogRelatives.beforeNode?.getBoundingClientRect()
            || viewPortRect;
        const topLeft = {
            x: cogCenter.x - this._initialDialogRect.x,
            y: cogCenter.y - this._initialDialogRect.y - this._initialDialogRect.height,
        };
        if (!e) {
            // if the dialog does not fit at the right of the cog, put it on the left
            if (topLeft.x + dialogRect.width > Math.min(
                viewPortRect.left + viewPortRect.width,
                beforeNodeRect.left + beforeNodeRect.width)) {
                this.offset.x = -dialogRect.width;
            }
            // if the dialog does not fit above the cog, put it below
            if (topLeft.y < Math.max(viewPortRect.top, beforeNodeRect.top)) {
                this.offset.y = this._initialDialogRect.height;
            }
        }
        topLeft.x -= beforeNodeRect.left;
        topLeft.y -= beforeNodeRect.top;
        // this is the new top left corner of the dialog
        const styleLeft = Math.round(topLeft.x + this.offset.x) + window.pageXOffset;
        const styleTop = Math.round(topLeft.y + this.offset.y) + window.pageYOffset;
        Object.assign(this.dialog.style, {
            left: `${styleLeft}px`,
            top: `${styleTop}px`,
        });
        if (!e) {
            // store the current positions of dialog and cog button
            // so when we get a scrolling event we can figure out
            // if and how they have scrolled
            this.dialogRect = {
                x: styleLeft,
                y: styleTop,
            };
            this.cogCenter = cogCenter;
        }
    }

    /**
     * Called to hide the SettingsDialog when clicking
     * outside the cog button boundaries.
     * @param {object} e click event
     */
    hideOnClick(e) {
        // tolerance (pixel)
        const TOL = 2;
        const cogButtonRect = this.buttons.cog.getBoundingClientRect();
        // if this is a spurious event or the user clicked
        // near the cog button, do nothing
        if (!cogButtonRect
            || (e.clientX > cogButtonRect.left - TOL && e.clientX < cogButtonRect.right + TOL
                && e.clientY > cogButtonRect.top - TOL && e.clientY < cogButtonRect.bottom + TOL)) {
            return;
        }
        const dialogRect = this.dialog.getBoundingClientRect();
        // unless the user clicked inside the dialog, hide it
        if (e.clientX < dialogRect.left || e.clientX > dialogRect.right
            || e.clientY < dialogRect.top || e.clientY > dialogRect.bottom) {
            this.hide();
        }
    }

    /**
     * Called to hide the SettingsDialog.
     */
    hide() {
        // Uncouple SettingsDialog from its divId
        // and the divId from its Scheduler
        const divId = this.renderer.getDivId(this.molDiv);
        if (this.currentDivId !== null) {
            const currentDiv = this.renderer.currentDivs().get(divId) || {};
            currentDiv.dispatcherId = null;
            this.currentDivId = null;
        }
        // remove event listeners
        window.removeEventListener('resize', this.setPosition);
        this.dialogRelatives.scrollingNode.removeEventListener('scroll', this.setPosition);
        this.clickNode.removeEventListener('click', this.hideOnClick);
        this.setButtonsAlwaysVisible(false);
        this.isExpanded.checked = false;
        this.dialogOuter.remove();
        this.enableCopyMolblock(true);
        this.isVisible = false;
    }

    /**
     * Called to show the SettingsDialog.
     */
    show() {
        // Couple SettingsDialog to the respective divId
        const divId = this.renderer.getDivId(this.molDiv);
        if (this.currentDivId !== null) {
            const currentDiv = this.renderer.currentDivs().get(divId) || {};
            currentDiv.dispatcherId = null;
        }
        this.currentDivId = divId;
        this.offset = { x: 0, y: 0 };
        // add event listeners
        this.isVisible = true;
        window.addEventListener('resize', this.setPosition);
        let { parentNode, beforeNode } = this.dialogRelatives;
        const { scrollingNode } = this.dialogRelatives;
        scrollingNode.addEventListener('scroll', this.setPosition, true);
        this.clickNode.addEventListener('mousedown', this.hideOnClick);
        this.setButtonsAlwaysVisible(true);
        if (!parentNode) {
            parentNode = document.body;
            beforeNode = parentNode.firstChild;
        } else if (typeof beforeNode === 'undefined') {
            beforeNode = parentNode.firstChild;
            this.dialogRelatives.beforeNode = beforeNode;
        }
        if (beforeNode) {
            parentNode.insertBefore(this.dialogOuter, beforeNode);
        } else {
            parentNode.appendChild(this.dialogOuter);
        }
        this.setPosition();
    }
}

export default SettingsDialog;
