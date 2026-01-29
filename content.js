let config = {
    inputPrice: null,
    inputTrigger: null
};

let setupState = {
    isConfiguring: false,
    currentStep: 0,
    steps: [
        { key: 'inputPrice', label: 'Bấm ô nhập "GIÁ ĐẶT"' },
        { key: 'inputTrigger', label: 'Bấm ô nhập "GIÁ THỊ TRƯỜNG"' }
    ]
};

// --- INIT ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}

function initExtension() {
    chrome.storage.local.get(['vpsConfig'], function (result) {
        if (result.vpsConfig) {
            config = { ...config, ...result.vpsConfig };
        }
        createMiniUI();
    });
}

// --- UI CHÍNH (MINI BAR) ---
function createMiniUI() {
    const old = document.getElementById('vps-helper-container');
    if (old) old.remove();

    const container = document.createElement('div');
    container.id = 'vps-helper-container';

    container.innerHTML = `
        <div id="setup-status" style="display:none; position:absolute; top:-30px; right:0; background:#333; padding:5px; border-radius:4px; font-size:12px; color:#fff;"></div>
        
        <button id="btn-start-setup" title="Cài đặt lại vị trí">⚙️</button>
        <input type="number" id="quick-price-input" placeholder="" autocomplete="off">
    `;

    document.body.appendChild(container);

    const input = document.getElementById('quick-price-input');
    const btnSetup = document.getElementById('btn-start-setup');

    const run = () => {
        executeAutoFill(input.value);
        input.value = ''; // Xóa sau khi nhập
        input.focus();
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') run();
    });

    btnSetup.addEventListener('click', startSetupMode);
}

// --- SETUP MODE ---
function startSetupMode() {
    setupState.isConfiguring = true;
    setupState.currentStep = 0;

    let overlay = document.getElementById('vps-overlay-msg');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'vps-overlay-msg';
        overlay.style.cssText = "display:none; position:fixed; top:50px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.9); border:2px solid #FF5722; color:#fff; padding:10px 20px; border-radius:20px; font-size:16px; font-weight:bold; z-index:2147483647; pointer-events:none;";
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'block';
    overlay.innerText = `BƯỚC 1/2: ${setupState.steps[0].label}`;

    document.addEventListener('mouseover', onHover, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onEsc, true);
}

function stopSetupMode() {
    setupState.isConfiguring = false;
    document.removeEventListener('mouseover', onHover, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onEsc, true);
    const overlay = document.getElementById('vps-overlay-msg');
    if (overlay) overlay.style.display = 'none';
}

function onEsc(e) {
    if (e.key === 'Escape') {
        stopSetupMode();
        showStatus("Đã hủy.");
    }
}

function onHover(e) {
    if (!setupState.isConfiguring) return;
    e.target.classList.add('vps-selector-hover');
    e.target.addEventListener('mouseout', () => {
        e.target.classList.remove('vps-selector-hover');
    }, { once: true });
}

function onClick(e) {
    if (!setupState.isConfiguring) return;
    e.preventDefault();
    e.stopPropagation();

    const target = e.target;
    target.classList.remove('vps-selector-hover');

    const sel = generateSelector(target);
    const key = setupState.steps[setupState.currentStep].key;
    config[key] = sel;

    target.classList.add('flash-success');
    setTimeout(() => target.classList.remove('flash-success'), 500);

    setupState.currentStep++;
    if (setupState.currentStep < setupState.steps.length) {
        document.getElementById('vps-overlay-msg').innerText = `BƯỚC ${setupState.currentStep + 1}/2: ${setupState.steps[setupState.currentStep].label}`;
    } else {
        chrome.storage.local.set({ vpsConfig: config });
        showStatus("✅ Đã lưu xong!");
        stopSetupMode();
        document.getElementById('quick-price-input').focus();
    }
}

function generateSelector(el) {
    if (el.id) return `#${el.id}`;
    if (el.name) return `[name="${el.name}"]`;
    let path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let sel = el.nodeName.toLowerCase();
        if (el.id) {
            sel += '#' + el.id;
            path.unshift(sel);
            break;
        } else {
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() == sel) nth++;
            }
            if (nth != 1) sel += ":nth-of-type(" + nth + ")";
        }
        path.unshift(sel);
        el = el.parentNode;
    }
    return path.join(" > ");
}

// --- EXECUTION LOGIC ---
function executeAutoFill(priceVal) {
    if (!priceVal) return showStatus("Nhập giá!");
    if (!config.inputPrice || !config.inputTrigger) {
        alert("Lần đầu sử dụng: Hãy cài đặt vị trí 2 ô nhập liệu trước!");
        startSetupMode();
        return;
    }

    try {
        const base = parseFloat(priceVal);
        if (isNaN(base)) return showStatus("Số lỗi!");

        const pVal = (base + 0.3).toFixed(1);
        const tVal = (base + 0.1).toFixed(1);

        const elP = document.querySelector(config.inputPrice);
        const elT = document.querySelector(config.inputTrigger);

        if (elP) setNativeValue(elP, pVal);
        if (elT) setNativeValue(elT, tVal);

        showStatus(`Done: ${pVal} | ${tVal}`);

    } catch (e) {
        console.error(e);
        showStatus("Lỗi: " + e.message);
    }
}

function setNativeValue(element, value) {
    const lastValue = element.value;
    element.value = value;
    const event = new Event('input', { bubbles: true });
    const tracker = element._valueTracker;
    if (tracker) tracker.setValue(lastValue);
    element.dispatchEvent(event);
    element.dispatchEvent(new Event('change', { bubbles: true }));
}

function showStatus(msg) {
    const el = document.getElementById('setup-status');
    if (el) {
        el.innerText = msg;
        el.style.display = 'block';
        setTimeout(() => el.style.display = 'none', 3000);
    }
}
