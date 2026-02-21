/**
 * Initializes the Hero Carousel functionality.
 * @param {HTMLElement} container - The container element for the Hero component.
 */
export function initHeroCarousel(container) {
    const track = container.querySelector("#hero-carousel-track");
    const dots = container.querySelectorAll(".hero__nav-dot");
    const trackingForm = container.querySelector("#tracking-form");
    let currentIndex = 0;
    const slideCount = dots.length;
    let autoPlayInterval;
    let isInteractionLocked = false;

    if (!track || dots.length === 0) {
        console.warn("Carousel elements not found in container.");
        return;
    }

    /**
     * Moves the carousel to a specific slide.
     * @param {number} index - Index of the slide to show.
     */
    function goToSlide(index) {
        currentIndex = index;
        // Since there are 2 slides, each is 50% width of the track (which is 200%)
        track.style.transform = `translateX(-${index * 50}%)`;

        // Update dots state
        dots.forEach((dot, i) => {
            if (i === index) {
                dot.classList.add("hero__nav-dot--active");
            } else {
                dot.classList.remove("hero__nav-dot--active");
            }
        });
    }

    /**
     * Starts the automatic rotation of slides.
     */
    function startAutoPlay() {
        if (isInteractionLocked) return;

        // Clear any existing interval to prevent multiple timers
        clearInterval(autoPlayInterval);
        autoPlayInterval = setInterval(() => {
            let nextIndex = (currentIndex + 1) % slideCount;
            goToSlide(nextIndex);
        }, 5000); // 5 seconds interval
    }

    /**
     * Resets the auto-play timer when manual navigation occurs.
     */
    function resetAutoPlay() {
        if (isInteractionLocked) return;
        startAutoPlay();
    }

    function lockCarousel() {
        isInteractionLocked = true;
        clearInterval(autoPlayInterval);
    }

    function unlockCarousel() {
        isInteractionLocked = false;
        startAutoPlay();
    }

    // Set up click events for navigation dots
    dots.forEach(dot => {
        dot.addEventListener("click", () => {
            const index = parseInt(dot.dataset.index);
            goToSlide(index);
            resetAutoPlay();
        });
    });

    if (trackingForm) {
        const interactiveFields = trackingForm.querySelectorAll("input, textarea, select");
        interactiveFields.forEach(field => {
            field.addEventListener("focus", lockCarousel);
            field.addEventListener("input", lockCarousel);
            field.addEventListener("keydown", lockCarousel);
            field.addEventListener("blur", unlockCarousel);
        });
    }

    // Initial state
    startAutoPlay();
}
