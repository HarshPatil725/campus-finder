/**
 * Layout helper for active navigation highlight and mobile drawer toggle
 */
document.addEventListener('DOMContentLoaded', () => {
    // Highlight active link based on current path
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-link-custom');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath || (currentPath === '' && href === 'index.html') || (currentPath === '/' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    console.log('[Layout] Initialized navigation for page:', currentPath);
});
