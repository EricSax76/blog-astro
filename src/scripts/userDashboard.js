import { observeAuth } from '../lib/firebase/auth';
import { getMyAccountContext } from '../lib/firebase/profiles';
import { redirectToLogin } from '../lib/auth/navigation';

// Toggle sidebar on mobile
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.getElementById('user-sidebar');

if (sidebarToggle && sidebar) {
	sidebarToggle.addEventListener('click', () => {
		sidebar.classList.toggle('is-open');
	});

	// Close sidebar when clicking outside on mobile
	document.addEventListener('click', (e) => {
		const target = e.target;
		if (
			window.innerWidth <= 768 &&
			sidebar.classList.contains('is-open') &&
			!sidebar.contains(target) &&
			!sidebarToggle.contains(target)
		) {
			sidebar.classList.remove('is-open');
		}
	});

	// Close sidebar when window is resized to desktop
	window.addEventListener('resize', () => {
		if (window.innerWidth > 768 && sidebar.classList.contains('is-open')) {
			sidebar.classList.remove('is-open');
		}
	});
}

// Protect routes - redirect to login if not authenticated
// Add a grace period to allow Firebase auth state to propagate after login
let authCheckCompleted = false;

observeAuth(async (user) => {
	// If no user after initialization, redirect to login
	if (!user) {
		// Wait a bit on first check to allow auth state to settle
		if (!authCheckCompleted) {
			await new Promise(resolve => setTimeout(resolve, 300));
			authCheckCompleted = true;
			// Re-check will happen automatically via observer
			return;
		}
		redirectToLogin('user');
		return;
	}

	authCheckCompleted = true;

	const context = await getMyAccountContext(user).catch(() => null);
	if (context?.kind === 'terapeuta') {
		window.location.replace('/terapeuta');
	}
});
