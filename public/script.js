document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Mouse Spotlight Effect ---
    // Creates a radial gradient that follows the mouse
    const spotlight = document.createElement('div');
    spotlight.classList.add('spotlight-overlay');
    document.body.appendChild(spotlight);

    // --- 5. Stardust Disintegration Init ---
    const stardustTargets = document.querySelectorAll('.hero-title, .hero-subtitle');

    stardustTargets.forEach(el => {
        el.classList.add('stardust-text');
        const text = el.innerText; // Use innerText to avoid parsing HTML tags if any (basic text only)
        el.innerHTML = ''; // Clear

        // Split into chars
        [...text].forEach(char => {
            const span = document.createElement('span');
            span.textContent = char;
            span.classList.add('stardust-char');

            // Assign static random seed mechanics for stable animation per character
            // Values between -1 and 1
            span.style.setProperty('--rng-x', (Math.random() * 2 - 1).toFixed(2));
            span.style.setProperty('--rng-y', (Math.random() * 2 - 1).toFixed(2));
            span.style.setProperty('--rng-rot', (Math.random() * 2 - 1).toFixed(2));

            el.appendChild(span);
        });
    });

    document.addEventListener('mousemove', (e) => {
        const x = e.clientX;
        const y = e.clientY;
        // Update CSS variables for the gradient center
        spotlight.style.setProperty('--x', `${x}px`);
        spotlight.style.setProperty('--y', `${y}px`);
    });

    // --- 2. Intersection Observer for Reveal ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.15 });

    const animatedElements = document.querySelectorAll('.timeline-item, .project-item, .edu-item');
    animatedElements.forEach(el => observer.observe(el));


    // --- 3. Devmode Trigger ---
    const secretCode = 'devmode';
    let inputSequence = '';
    window.addEventListener('keydown', (e) => {
        inputSequence += e.key.toLowerCase();
        if (inputSequence.length > secretCode.length) {
            inputSequence = inputSequence.substr(inputSequence.length - secretCode.length);
        }
        if (inputSequence === secretCode) {
            window.location.href = '/login';
        }
    });

    // --- 4. Dynamic Navbar Hide ---
    // --- 4. Dynamic Navbar Fade (Scroll-Linked) ---
    const nav = document.querySelector('.header nav');
    let ticking = false;

    function updateNavFade() {
        const scrollY = window.scrollY;

        // 1. Stardust Disintegration Logic
        // Trigger disintegration when elements are 180px from top (approaching nav)
        const triggerHeight = 180;
        const fadeRange = 100; // Complete disintegration over 100px of scroll

        if (typeof stardustTargets !== 'undefined') {
            stardustTargets.forEach(el => {
                const rect = el.getBoundingClientRect();

                // If element is well below danger zone, prog is 0 (visible)
                // If element is at triggerHeight, prog is 0
                // If element is at (triggerHeight - fadeRange), prog is 1 (gone)

                // Distance into the danger zone (positive value means inside danger zone)
                const dangerDepth = triggerHeight - rect.top;

                let prog = dangerDepth / fadeRange;

                // Clamp 0 to 1
                prog = Math.max(0, Math.min(1, prog));

                el.style.setProperty('--dis-prog', prog.toFixed(3));
            });
        }

        // 2. Fast Navbar Fade (30% of viewport)
        const fadeThreshold = window.innerHeight * 0.3;

        let opacity = 1 - (scrollY / fadeThreshold);
        // Clamp between 0 and 1
        opacity = Math.max(0, Math.min(1, opacity));

        if (nav) {
            nav.style.opacity = opacity;
            // Disable pointer events when hidden so clicks pass through
            nav.style.pointerEvents = opacity <= 0.1 ? 'none' : 'auto';
        }

        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            window.requestAnimationFrame(updateNavFade);
            ticking = true;
        }
    });
});
