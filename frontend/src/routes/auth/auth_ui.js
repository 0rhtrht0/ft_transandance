export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function customPrompt(message, defaultValue = "", type = "text") {
    return new Promise((resolve) => {
        const dialog = document.createElement("dialog");
        dialog.className = "auth-custom-prompt";
        dialog.style.cssText = "padding: 20px; border-radius: 8px; border: 1px solid #444; background: rgba(30,30,40,0.9); color: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.5); backdrop-filter: blur(5px); display: flex; flex-direction: column; gap: 15px; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); min-width: 300px; z-index: 9999;";
        
        dialog.innerHTML = `
            <div style="font-size: 16px; font-weight: bold; text-align: center;">${message}</div>
            <input type="${type}" value="${defaultValue}" style="width: 100%; padding: 10px; border: 1px solid #666; border-radius: 4px; background: #222; color: #fff; text-align: center;" />
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <button type="button" id="prompt-cancel" style="padding: 8px 16px; border: 1px solid #666; border-radius: 4px; background: transparent; color: white; cursor: pointer; transition: background 0.2s;">Cancel</button>
                <button type="button" id="prompt-ok" style="padding: 8px 16px; border: none; border-radius: 4px; background: #fff; color: #000; cursor: pointer; font-weight: bold; transition: opacity 0.2s;">OK</button>
            </div>
        `;
        document.body.appendChild(dialog);
        const input = dialog.querySelector("input");
        const btnOk = dialog.querySelector("#prompt-ok");
        const btnCancel = dialog.querySelector("#prompt-cancel");

        const cleanup = (value) => {
            dialog.close();
            document.body.removeChild(dialog);
            resolve(value);
        };

        btnOk.addEventListener("click", () => cleanup(input.value));
        btnCancel.addEventListener("click", () => cleanup(null));
        dialog.addEventListener("cancel", () => cleanup(null));
        
        dialog.showModal();
        input.focus();
    });
}

export function showFeedback(feedbackNode, message, type = "error") {
    feedbackNode.textContent = message
    feedbackNode.className = `auth-feedback is-visible is-${type}`
}

export function clearFeedback(feedbackNode) {
    feedbackNode.textContent = ""
    feedbackNode.className = "auth-feedback"
}

export function setRegisterFieldsVisibility({ isRegisterMode, emailInput, confirmPasswordInput, passwordInput }) {
    let visibleValue
    if (isRegisterMode) {
        visibleValue = "block"
    } else {
        visibleValue = "none"
    }

    emailInput.style.display = visibleValue
    confirmPasswordInput.style.display = visibleValue

    emailInput.disabled = !isRegisterMode
    confirmPasswordInput.disabled = !isRegisterMode

    emailInput.required = isRegisterMode
    confirmPasswordInput.required = isRegisterMode

    if (!isRegisterMode) {
        emailInput.value = ""
        confirmPasswordInput.value = ""
        passwordInput.autocomplete = "current-password"
    } else {
        passwordInput.autocomplete = "new-password"
    }
}

export function setupAuthParallax(scene) {
    if (!scene) {
        return () => {}
    }

    const updateParallax = (event) => {
        const bounds = scene.getBoundingClientRect()
        const ratioX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
        const ratioY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

        scene.style.setProperty("--mx", ratioX.toFixed(3))
        scene.style.setProperty("--my", ratioY.toFixed(3))
    }

    const resetParallax = () => {
        scene.style.setProperty("--mx", "0")
        scene.style.setProperty("--my", "0")
    }

    scene.addEventListener("pointermove", updateParallax)
    scene.addEventListener("pointerleave", resetParallax)

    return () => {
        scene.removeEventListener("pointermove", updateParallax)
        scene.removeEventListener("pointerleave", resetParallax)
    }
}
