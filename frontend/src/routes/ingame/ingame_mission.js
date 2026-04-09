const lines = [
    "Every step could be your last.",
    "Your fear is their strength.",
    "The maze shifts. The ghosts remain."
]

function setupIngameParallax(ingameRoot) {
    if (!ingameRoot) {
        return () => {}
    }

    const updateParallax = (event) => {
        const bounds = ingameRoot.getBoundingClientRect()
        const ratioX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
        const ratioY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2

        ingameRoot.style.setProperty("--mx", ratioX.toFixed(3))
        ingameRoot.style.setProperty("--my", ratioY.toFixed(3))
    }

    const resetParallax = () => {
        ingameRoot.style.setProperty("--mx", "0")
        ingameRoot.style.setProperty("--my", "0")
    }

    ingameRoot.addEventListener("pointermove", updateParallax)
    ingameRoot.addEventListener("pointerleave", resetParallax)

    return () => {
        ingameRoot.removeEventListener("pointermove", updateParallax)
        ingameRoot.removeEventListener("pointerleave", resetParallax)
    }
}

export function initMissionFeed(ingameRoot, onComplete) {
    const lineElement = document.getElementById("line")
    const disposeParallax = setupIngameParallax(ingameRoot)
    const isRouteAlive = () => Boolean(ingameRoot) && document.body.contains(ingameRoot)
    let index = 0
    let isCompleted = false
    let intervalId = null
    let completeTimeoutId = null

    const clearTimers = () => {
        if (intervalId !== null) {
            clearInterval(intervalId)
            intervalId = null
        }
        if (completeTimeoutId !== null) {
            clearTimeout(completeTimeoutId)
            completeTimeoutId = null
        }
    }

    const handleSkipPointerDown = (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) {
            return
        }
        complete()
    }

    const complete = () => {
        if (isCompleted) {
            return
        }
        isCompleted = true
        clearTimers()
        if (ingameRoot) {
            ingameRoot.removeEventListener("pointerdown", handleSkipPointerDown)
        }
        disposeParallax()
        if (typeof onComplete === "function") {
            onComplete()
        }
    }

    if (!lineElement) {
        complete()
        return
    }
    if (ingameRoot) {
        ingameRoot.addEventListener("pointerdown", handleSkipPointerDown)
    }

    const revealLine = (text) => {
        lineElement.classList.remove("fade-in")
        lineElement.classList.add("hidden")

        requestAnimationFrame(() => {
            lineElement.textContent = text
            lineElement.classList.remove("hidden")
            lineElement.classList.add("fade-in")
        })
    }

    revealLine(lines[index])

    intervalId = setInterval(() => {
        if (!isRouteAlive()) {
            clearTimers()
            if (ingameRoot) {
                ingameRoot.removeEventListener("pointerdown", handleSkipPointerDown)
            }
            disposeParallax()
            return
        }

        index += 1
        if (index < lines.length) {
            revealLine(lines[index])
        } else {
            clearInterval(intervalId)
            intervalId = null
            completeTimeoutId = setTimeout(() => {
                if (!isRouteAlive()) {
                    return
                }
                complete()
            }, 1200)
        }
    }, 1500)
}
