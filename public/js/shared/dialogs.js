import { cycleFocus, escapeHtml } from './utils.js';

let dialogCounter = 0;

function mountDialog(overlay) {
    const previous = document.activeElement;
    document.body.appendChild(overlay);
    const focusable = overlay.querySelectorAll('button, input, select, textarea');
    const initial = overlay.querySelector('[data-dialog-initial]') || focusable[0];
    if (initial) initial.focus();

    const onKey = event => {
        if (event.key === 'Escape') {
            event.preventDefault();
            overlay.dispatchEvent(new CustomEvent('dialog-dismiss'));
        } else if (event.key === 'Tab') {
            cycleFocus(overlay, event);
        }
    };
    document.addEventListener('keydown', onKey, true);

    return function teardown() {
        document.removeEventListener('keydown', onKey, true);
        overlay.remove();
        if (previous && document.contains(previous)) previous.focus();
    };
}

function buildBase({ title, role = 'dialog' }) {
    const id = `dlg-${++dialogCounter}`;
    const overlay = document.createElement('div');
    overlay.className = 'dialog-overlay';
    overlay.setAttribute('role', role);
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', `${id}-title`);
    overlay.setAttribute('data-dialog', id);
    overlay.innerHTML = `
        <div class="dialog-card" role="document">
            <h2 id="${id}-title" class="dialog-title">${escapeHtml(title)}</h2>
            <div data-dialog-body></div>
        </div>`;
    overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.dispatchEvent(new CustomEvent('dialog-dismiss'));
    });
    return overlay;
}

function waitForResult(overlay) {
    return new Promise(resolve => {
        const teardown = mountDialog(overlay);
        const done = result => {
            teardown();
            resolve(result);
        };
        overlay.addEventListener('dialog-confirm', () => done(true));
        overlay.addEventListener('dialog-cancel', () => done(false));
        overlay.addEventListener('dialog-dismiss', () => done(false));
        overlay.addEventListener('dialog-value', event => done(event.detail));
    });
}

export function confirmDialog({ title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', destructive = false } = {}) {
    const overlay = buildBase({ title: title || '¿Confirmar?' });
    const body = overlay.querySelector('[data-dialog-body]');
    const confirmClass = destructive ? 'btn btn-danger' : 'btn btn-primary';
    body.innerHTML = `
        <p class="dialog-message">${escapeHtml(message || '')}</p>
        <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-dialog-cancel>${escapeHtml(cancelLabel)}</button>
            <button type="button" class="${confirmClass}" data-dialog-confirm data-dialog-initial>${escapeHtml(confirmLabel)}</button>
        </div>`;
    body.querySelector('[data-dialog-confirm]').addEventListener('click', () =>
        overlay.dispatchEvent(new CustomEvent('dialog-confirm')));
    body.querySelector('[data-dialog-cancel]').addEventListener('click', () =>
        overlay.dispatchEvent(new CustomEvent('dialog-cancel')));
    return waitForResult(overlay);
}

export function alertDialog({ title, message, label = 'Entendido' } = {}) {
    const overlay = buildBase({ title: title || 'Aviso' });
    const body = overlay.querySelector('[data-dialog-body]');
    body.innerHTML = `
        <p class="dialog-message">${escapeHtml(message || '')}</p>
        <div class="dialog-actions">
            <button type="button" class="btn btn-primary" data-dialog-confirm data-dialog-initial>${escapeHtml(label)}</button>
        </div>`;
    body.querySelector('[data-dialog-confirm]').addEventListener('click', () =>
        overlay.dispatchEvent(new CustomEvent('dialog-confirm')));
    return waitForResult(overlay);
}

export function promptDialog({ title, message, defaultValue = '', confirmLabel = 'Aceptar', cancelLabel = 'Cancelar', inputType = 'text' } = {}) {
    const overlay = buildBase({ title: title || 'Ingrese un valor' });
    const id = `dlg-input-${dialogCounter}`;
    const body = overlay.querySelector('[data-dialog-body]');
    body.innerHTML = `
        <p class="dialog-message">${escapeHtml(message || '')}</p>
        <label class="form-label sr-only" for="${id}">${escapeHtml(message || title || 'Valor')}</label>
        <input id="${id}" type="${inputType}" class="form-control" value="${escapeHtml(String(defaultValue))}" data-dialog-initial>
        <div class="dialog-actions">
            <button type="button" class="btn btn-secondary" data-dialog-cancel>${escapeHtml(cancelLabel)}</button>
            <button type="button" class="btn btn-primary" data-dialog-confirm>${escapeHtml(confirmLabel)}</button>
        </div>`;
    const input = body.querySelector('input');
    body.querySelector('[data-dialog-confirm]').addEventListener('click', () =>
        overlay.dispatchEvent(new CustomEvent('dialog-value', { detail: input.value })));
    body.querySelector('[data-dialog-cancel]').addEventListener('click', () =>
        overlay.dispatchEvent(new CustomEvent('dialog-value', { detail: null })));
    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            overlay.dispatchEvent(new CustomEvent('dialog-value', { detail: input.value }));
        }
    });
    return waitForResult(overlay);
}
