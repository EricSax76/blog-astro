if (typeof window !== 'undefined') {
const header = document.querySelector('.site-header');
const primaryNav = document.querySelector('.primary-nav');
const navToggle = document.querySelector('.nav-toggle');
const primaryMenu = document.querySelector('#primary-menu');

if (header) {
    const handleScroll = () => {
        const shouldHide = window.scrollY > 300;
        header.classList.toggle('is-hidden', shouldHide);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
}

    

const dropdownParents = document.querySelectorAll('.has-dropdown');

dropdownParents.forEach((parent) => {
    const dropdownMenu = parent.querySelector('.dropdown');
    if (!dropdownMenu) return;

    parent.addEventListener('mouseenter', () => parent.classList.add('open'));
    parent.addEventListener('mouseleave', () => parent.classList.remove('open'));

    parent.addEventListener('click', (event) => {
        if (window.innerWidth > 768) {
            return;
        }

        const isOpen = parent.classList.contains('open');
        if (!isOpen) {
            event.preventDefault();
            parent.classList.add('open');
        }
    });
});

const TEXT_LIMIT = 200;

const toggleText = (section) => {
    const textElement = section.querySelector('p');
    const readMoreLink = section.querySelector('.read-more');

    if (!textElement || !readMoreLink) return;

    const fullText = textElement.textContent.trim();
    if (fullText.length <= TEXT_LIMIT) {
        readMoreLink.style.display = 'none';
        return;
    }

    const truncatedText = `${fullText.substring(0, TEXT_LIMIT)}...`;
    let isTruncated = true;

    textElement.textContent = truncatedText;
    readMoreLink.setAttribute('aria-expanded', 'false');
    readMoreLink.style.display = 'inline';

    readMoreLink.addEventListener('click', (event) => {
        event.preventDefault();
        isTruncated = !isTruncated;

        textElement.textContent = isTruncated ? truncatedText : fullText;
        readMoreLink.textContent = isTruncated ? 'Leer más...' : 'Leer menos...';
        readMoreLink.setAttribute('aria-expanded', String(!isTruncated));
    });
};

document.querySelectorAll('section').forEach(toggleText);
}
