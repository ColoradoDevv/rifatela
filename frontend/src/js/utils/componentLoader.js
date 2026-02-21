import { devLog, devError } from './logger.js';
import { getFrontendBasePath } from '../config.js';

/**
 * Resuelve rutas relativas al directorio src del frontend.
 * Usa base absoluta desde la raíz del sitio (/src/ o /subpath/src/) para no depender
 * de la profundidad del pathname de la página actual.
 */
function resolvePath(relativePath) {
    const base = getFrontendBasePath();
    const pathname = window.location.pathname;
    const hasSrc = pathname.indexOf('/src/') !== -1;

    if (hasSrc) {
        const clean = relativePath.replace(/^\.\//, '').replace(/^\.\.\//, '');
        return base + clean;
    }
    const pathParts = pathname.split('/').filter(p => p && !p.endsWith('.html'));
    const depth = pathParts.length;
    const prefix = depth > 0 ? '../'.repeat(depth) : '';
    return prefix + relativePath.replace(/^\.\//, '');
}

export function loadComponents() {
    // Resolve config path based on current location
    const configPath = resolvePath("config/components.json");

    fetch(configPath)
        .then(response => {
            if (!response.ok) {
                throw new Error("Could not load component configuration: " + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.components && Array.isArray(data.components)) {
                data.components.forEach(comp => loadComponent(comp));
            }
        })
        .catch(error => devError("Error initializing component loader:", error));
}

function loadComponent(comp) {
    const container = document.querySelector(comp.selector);
    if (!container) return;

    // Cargar estilos si existen
    if (comp.styles && Array.isArray(comp.styles)) {
        comp.styles.forEach(stylePath => {
            const resolvedPath = resolvePath(stylePath.replace('../', ''));
            loadStyle(resolvedPath);
        });
    }

    // Resolve template path
    const templatePath = resolvePath(comp.template.replace('../', ''));

    fetch(templatePath)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error loading template ${templatePath}: ` + response.statusText);
            }
            return response.text();
        })
        .then(html => {
            container.innerHTML = html;
            if (comp.class) {
                container.classList.add(comp.class);
            }

            // Highlight active nav item if it's the header
            if (comp.selector === ".header-container") {
                highlightActiveNav(container);
            }

            // Dispatch event for other features to initialize
            document.dispatchEvent(new CustomEvent("componentLoaded", {
                detail: { selector: comp.selector, container: container }
            }));

            devLog(`Component loaded into ${comp.selector}`);
        })
        .catch(error => devError(`Error loading component ${comp.selector}:`, error));
}

function highlightActiveNav(container) {
    const currentPath = window.location.pathname;
    const navLinks = container.querySelectorAll(".header__nav-item");

    // Map of routes to their corresponding paths
    const routeMap = {
        '/inicio': ['/inicio', '/', ''],
        '/rifas': ['/rifas'],
        '/ganadores': ['/ganadores'],
        '/soporte': ['/soporte'],
        '/admin': ['/admin', '/dashboard', '/admin/vendedores', '/admin/new-sellers'],
        '/ventas': ['/ventas', '/admin/register-sale'],
        '/login': ['/login']
    };

    navLinks.forEach(link => {
        const linkPath = link.getAttribute("href");
        let isActive = false;

        // Check if current path matches the link path
        if (linkPath === currentPath) {
            isActive = true;
        } else {
            // Check route mapping for friendly routes
            for (const [route, paths] of Object.entries(routeMap)) {
                if (paths.includes(currentPath) && linkPath === route) {
                    isActive = true;
                    break;
                }
            }
        }

        if (isActive) {
            link.classList.add("header__nav-item--active");
        } else {
            link.classList.remove("header__nav-item--active");
        }
    });
}

function loadStyle(href) {
    // Evitar duplicados
    if (document.querySelector(`link[href="${href}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
    devLog(`Style loaded: ${href}`);
}
