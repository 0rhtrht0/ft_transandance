const lines = [
    "The darkness is already watching you.",
    "There is an exit. You were never meant to reach it.",
    "Do not turn back.",
    "The Blackhole is closing in.",
];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function setupIntroParallax(introRoot) {
    if (!introRoot) {
        return () => {};
    }

    const updateParallax = (event) => {
        const bounds = introRoot.getBoundingClientRect();
        const ratioX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
        const ratioY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

        introRoot.style.setProperty("--mx", ratioX.toFixed(3));
        introRoot.style.setProperty("--my", ratioY.toFixed(3));
    };

    const resetParallax = () => {
        introRoot.style.setProperty("--mx", "0");
        introRoot.style.setProperty("--my", "0");
    };

    introRoot.addEventListener("pointermove", updateParallax);
    introRoot.addEventListener("pointerleave", resetParallax);

    return () => {
        introRoot.removeEventListener("pointermove", updateParallax);
        introRoot.removeEventListener("pointerleave", resetParallax);
    };
}

async function revealLine(lineElement, text, isRouteAlive, revealDuration = 1100) {
    if (!isRouteAlive()) {
        return false;
    }

    lineElement.classList.remove("horror-reveal");
    lineElement.classList.remove("horror-idle");
    lineElement.classList.remove("fade-in");
    lineElement.classList.add("hidden");
    lineElement.removeAttribute("data-echo");

    await sleep(80);
    if (!isRouteAlive()) {
        return false;
    }

    lineElement.textContent = text;
    lineElement.setAttribute("data-echo", text);
    lineElement.classList.remove("hidden");
    lineElement.classList.add("horror-reveal");

    await sleep(revealDuration);
    if (!isRouteAlive()) {
        return false;
    }

    lineElement.classList.remove("horror-reveal");
    lineElement.classList.add("horror-idle");
    return true;
}

export function init_intro(goTo) {
    const introRoot = document.querySelector(".intro");
    const title = document.getElementById("title");
    const subtitle = document.getElementById("subtitle");
    const line = document.getElementById("line");
    const question = document.getElementById("question");
    const button = document.getElementById("enter-btn");
    const questionText = question.textContent.trim();
    question.textContent = "";

    const disposeParallax = setupIntroParallax(introRoot);
    const isRouteAlive = () => document.body.contains(introRoot);

    button.addEventListener(
        "click",
        () => {
            disposeParallax();
            goTo("auth");
        },
        { once: true }
    );

    (async () => {
        await sleep(800);
        if (!isRouteAlive()) {
            return;
        }
        title.classList.add("fade-in");

        await sleep(350);
        if (!isRouteAlive()) {
            return;
        }
        subtitle.classList.add("fade-in");

        await sleep(850);
        for (const sentence of lines) {
            if (!isRouteAlive()) {
                return;
            }
            const hasRenderedLine = await revealLine(line, sentence, isRouteAlive);
            if (!hasRenderedLine) {
                return;
            }
            await sleep(780);
        }

        const hasRenderedQuestion = await revealLine(question, questionText, isRouteAlive, 1300);
        if (!hasRenderedQuestion) {
            return;
        }

        await sleep(800);
        if (!isRouteAlive()) {
            return;
        }
        button.classList.add("fade-in");
    })();
}
