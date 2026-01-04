/**
 * 2NetWorld - Main JavaScript
 * Handles 3D Earth animation, GSAP timeline, and page interactivity
 */

// =============================================
// Global Variables
// =============================================
let scene, camera, renderer, earth, earthGroup;
let animationFrameId;
let introComplete = false;
const isMobile = window.innerWidth < 768;

// Animation timeline
let masterTimeline;

// DOM Elements
const loader = document.getElementById('loader');
const skipBtn = document.getElementById('skip-intro');
const sceneContainer = document.getElementById('scene-container');
const heroContent = document.getElementById('hero-content');
const logo = document.getElementById('logo');
const menuToggle = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');

// =============================================
// Initialize Everything
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  initEventListeners();
  initScrollAnimations();

  // Hide loader and start intro after a brief delay
  setTimeout(() => {
    loader.classList.add('hidden');
    skipBtn.classList.add('visible');
    startIntroAnimation();
  }, 1500);
});

// =============================================
// Three.js Setup - 3D Earth
// =============================================
function initThreeJS() {
  // Scene
  scene = new THREE.Scene();

  // Camera
  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 5;

  // Renderer
  renderer = new THREE.WebGLRenderer({
    antialias: !isMobile,
    alpha: true
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  sceneContainer.appendChild(renderer.domElement);

  // Create Earth
  createEarth();

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  // Add subtle blue rim light
  const rimLight = new THREE.PointLight(0x00ffcc, 0.5, 10);
  rimLight.position.set(-3, 0, 2);
  scene.add(rimLight);

  // Handle resize
  window.addEventListener('resize', onWindowResize);

  // Start render loop
  animate();
}

function createEarth() {
  earthGroup = new THREE.Group();

  const radius = 1.5;
  // ORIGINAL: segments = isMobile ? 32 : 48
  const segments = isMobile ? 24 : 32;

  // === LAYER 1: Main wireframe globe ===
  const mainGeometry = new THREE.SphereGeometry(radius, segments, segments);
  const mainMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    wireframe: true,
    transparent: true,
    opacity: 0.4
  });
  earth = new THREE.Mesh(mainGeometry, mainMaterial);
  earthGroup.add(earth);

  // === LAYER 2: Inner core wireframe (smaller, different density) ===
  // ORIGINAL: 16, 16
  const innerGeometry = new THREE.SphereGeometry(radius * 0.7, 12, 12);
  const innerMaterial = new THREE.MeshBasicMaterial({
    color: 0x0099ff,
    wireframe: true,
    transparent: true,
    opacity: 0.2
  });
  const innerCore = new THREE.Mesh(innerGeometry, innerMaterial);
  earthGroup.add(innerCore);

  // === LAYER 3: Outer shell wireframe (larger, sparse) ===
  // ORIGINAL: 24, 24
  const outerGeometry = new THREE.SphereGeometry(radius * 1.1, 16, 16);
  const outerMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    wireframe: true,
    transparent: true,
    opacity: 0.15
  });
  const outerShell = new THREE.Mesh(outerGeometry, outerMaterial);
  earthGroup.add(outerShell);

  // === LAYER 4: Glowing nodes at intersections ===
  const nodeGeometry = new THREE.BufferGeometry();
  const nodePositions = [];
  const nodeSizes = [];

  // Generate points on sphere surface (Fibonacci sphere distribution)
  const numNodes = isMobile ? 80 : 150;
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < numNodes; i++) {
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / numNodes);

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);

    nodePositions.push(x, y, z);
    nodeSizes.push(2 + Math.random() * 3);
  }

  nodeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(nodePositions, 3));
  nodeGeometry.setAttribute('size', new THREE.Float32BufferAttribute(nodeSizes, 1));

  const nodeMaterial = new THREE.PointsMaterial({
    color: 0x00ffcc,
    size: 0.04,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });

  const nodes = new THREE.Points(nodeGeometry, nodeMaterial);
  earthGroup.add(nodes);

  // === LAYER 5: Atmosphere glow ===
  const atmosphereGeometry = new THREE.SphereGeometry(radius * 1.2, 32, 32);
  const atmosphereMaterial = new THREE.MeshBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.08,
    side: THREE.BackSide
  });
  const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
  earthGroup.add(atmosphere);

  // === LAYER 6: Equator and meridian rings ===
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x00ffcc,
    transparent: true,
    opacity: 0.6
  });

  // Equator
  const equatorPoints = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    equatorPoints.push(new THREE.Vector3(
      radius * Math.cos(angle),
      0,
      radius * Math.sin(angle)
    ));
  }
  const equatorGeometry = new THREE.BufferGeometry().setFromPoints(equatorPoints);
  const equator = new THREE.Line(equatorGeometry, ringMaterial);
  earthGroup.add(equator);

  // Prime meridian
  const meridianPoints = [];
  for (let i = 0; i <= 64; i++) {
    const angle = (i / 64) * Math.PI * 2;
    meridianPoints.push(new THREE.Vector3(
      radius * Math.cos(angle),
      radius * Math.sin(angle),
      0
    ));
  }
  const meridianGeometry = new THREE.BufferGeometry().setFromPoints(meridianPoints);
  const meridian = new THREE.Line(meridianGeometry, ringMaterial);
  earthGroup.add(meridian);

  // Store references for animation
  earthGroup.userData = {
    innerCore,
    outerShell,
    nodes
  };

  // Initial state - very small and far away
  earthGroup.scale.set(0.1, 0.1, 0.1);
  earthGroup.position.z = -10;

  scene.add(earthGroup);
}

function animate() {
  animationFrameId = requestAnimationFrame(animate);

  // Rotate Earth layers at different speeds for depth effect
  // ORIGINAL speeds: 0.003, -0.002, 0.001, 0.001
  if (earthGroup && earthGroup.userData) {
    // Main globe rotation (slower)
    earth.rotation.y += 0.0015;

    // Inner core rotates opposite direction (slower)
    if (earthGroup.userData.innerCore) {
      earthGroup.userData.innerCore.rotation.y -= 0.001;
      earthGroup.userData.innerCore.rotation.x += 0.0005;
    }

    // Outer shell rotates slowly
    if (earthGroup.userData.outerShell) {
      earthGroup.userData.outerShell.rotation.y += 0.0005;
    }

    // Pulse the nodes opacity for a living effect
    if (earthGroup.userData.nodes) {
      const time = Date.now() * 0.001;
      earthGroup.userData.nodes.material.opacity = 0.6 + Math.sin(time * 2) * 0.3;
    }

  }

  renderer.render(scene, camera);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// =============================================
// GSAP Animation Timeline
// =============================================
function startIntroAnimation() {
  // Register GSAP plugins
  gsap.registerPlugin(ScrollTrigger);

  // Create master timeline
  masterTimeline = gsap.timeline({
    onComplete: () => {
      introComplete = true;
      skipBtn.classList.add('hidden');
    }
  });

  // Phase 1: Earth zooms in from distance (0-3s)
  masterTimeline.to(earthGroup.scale, {
    x: 1,
    y: 1,
    z: 1,
    duration: 3,
    ease: 'power2.out'
  }, 0);

  masterTimeline.to(earthGroup.position, {
    z: 0,
    duration: 3,
    ease: 'power2.out'
  }, 0);

  // Phase 2: Earth pulses with energy (3-5s)
  masterTimeline.to(earthGroup.scale, {
    x: 1.1,
    y: 1.1,
    z: 1.1,
    duration: 0.5,
    ease: 'power2.out',
    yoyo: true,
    repeat: 3
  }, 3);

  // Phase 3: Earth moves to corner (5-7s)
  const logoRect = document.querySelector('.logo').getBoundingClientRect();
  const targetX = (logoRect.left + 20 - window.innerWidth / 2) / (window.innerWidth / 4);
  const targetY = (logoRect.top + 20 - window.innerHeight / 2) / (window.innerHeight / 4);

  masterTimeline.to(earthGroup.position, {
    x: targetX,
    y: -targetY,
    z: 3,
    duration: 2,
    ease: 'power2.inOut'
  }, 5);

  masterTimeline.to(earthGroup.scale, {
    x: 0.15,
    y: 0.15,
    z: 0.15,
    duration: 2,
    ease: 'power2.inOut'
  }, 5);

  // Fade out 3D canvas
  masterTimeline.to(sceneContainer, {
    opacity: 0,
    duration: 1,
    ease: 'power2.out'
  }, 6);

  // Show logo
  masterTimeline.add(() => {
    logo.classList.add('visible');
  }, 6.5);

  // Phase 4: Content reveals (7s+)
  masterTimeline.add(() => {
    heroContent.classList.add('visible');
  }, 7);

  masterTimeline.from('.hero-title .title-line', {
    y: 50,
    opacity: 0,
    duration: 0.8,
    stagger: 0.2,
    ease: 'power3.out'
  }, 7);

  masterTimeline.from('.hero-subtitle', {
    y: 30,
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out'
  }, 7.5);

  masterTimeline.from('.hero-description', {
    y: 30,
    opacity: 0,
    duration: 0.6,
    ease: 'power2.out'
  }, 7.8);

  masterTimeline.from('.hero-cta .btn', {
    y: 30,
    opacity: 0,
    duration: 0.6,
    stagger: 0.15,
    ease: 'power2.out'
  }, 8);
}

function skipIntro() {
  if (masterTimeline) {
    masterTimeline.progress(1);
  }

  // Immediately show everything
  gsap.set(earthGroup.scale, { x: 0.15, y: 0.15, z: 0.15 });
  gsap.set(earthGroup.position, { x: -3, y: 2, z: 3 });
  gsap.set(sceneContainer, { opacity: 0 });

  logo.classList.add('visible');
  heroContent.classList.add('visible');
  skipBtn.classList.add('hidden');

  introComplete = true;
}

// =============================================
// Scroll Animations
// =============================================
function initScrollAnimations() {
  // About section animations
  ScrollTrigger.create({
    trigger: '#about',
    start: 'top 80%',
    onEnter: () => {
      document.querySelector('.about-text').classList.add('visible');

      // Animate stats with stagger
      const stats = document.querySelectorAll('.stat');
      stats.forEach((stat, index) => {
        setTimeout(() => {
          stat.classList.add('visible');
          animateCounter(stat.querySelector('.stat-number'));
        }, index * 200);
      });
    }
  });

  // Services cards animation
  ScrollTrigger.create({
    trigger: '#services',
    start: 'top 80%',
    onEnter: () => {
      const cards = document.querySelectorAll('.service-card');
      cards.forEach((card, index) => {
        setTimeout(() => {
          card.classList.add('visible');
        }, index * 100);
      });
    }
  });

  // Update nav link active state on scroll
  const sections = document.querySelectorAll('.section');
  sections.forEach(section => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top center',
      end: 'bottom center',
      onEnter: () => updateActiveNavLink(section.id),
      onEnterBack: () => updateActiveNavLink(section.id)
    });
  });
}

function animateCounter(element) {
  const target = parseInt(element.dataset.count);
  const duration = 2000;
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic

    element.textContent = Math.floor(start + (target - start) * easeProgress);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = target;
    }
  }

  requestAnimationFrame(update);
}

function updateActiveNavLink(sectionId) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === sectionId) {
      link.classList.add('active');
    }
  });
}

// =============================================
// Event Listeners
// =============================================
function initEventListeners() {
  // Skip intro button
  skipBtn.addEventListener('click', skipIntro);

  // Menu toggle
  menuToggle.addEventListener('click', () => {
    menuToggle.classList.toggle('active');
    sidebar.classList.toggle('active');
  });

  // Nav links - close menu and smooth scroll
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();

      // Close menu
      menuToggle.classList.remove('active');
      sidebar.classList.remove('active');

      // Scroll to section
      const targetId = link.getAttribute('href');
      const targetSection = document.querySelector(targetId);
      if (targetSection) {
        targetSection.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // CTA buttons smooth scroll
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const href = this.getAttribute('href');
      if (href !== '#') {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  // Contact form submission
  const contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', handleFormSubmit);
  }

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    // ESC to close menu
    if (e.key === 'Escape') {
      menuToggle.classList.remove('active');
      sidebar.classList.remove('active');
    }

    // Space or Enter to skip intro (when focused on skip button)
    if ((e.key === ' ' || e.key === 'Enter') && !introComplete && document.activeElement === skipBtn) {
      skipIntro();
    }
  });

  // Auto skip for returning visitors (disabled for testing)
  // if (sessionStorage.getItem('visited')) {
  //   setTimeout(skipIntro, 500);
  // } else {
  //   sessionStorage.setItem('visited', 'true');
  // }
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;

  // Show loading state
  submitBtn.innerHTML = '<span>Sending...</span>';
  submitBtn.disabled = true;

  try {
    // Send form data to PHP script
    const formData = new FormData(form);

    // Convert FormData to JSON for API
    const data = Object.fromEntries(formData.entries());

    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (result.success) {
      // Success state
      submitBtn.innerHTML = '<span>Message Sent!</span>';
      submitBtn.style.background = '#00cc66';
      form.reset();
    } else {
      // Error state
      submitBtn.innerHTML = '<span>Failed to Send</span>';
      submitBtn.style.background = '#ef4444';
      alert(result.message || 'Failed to send message. Please try again.');
    }
  } catch (error) {
    // Network error
    submitBtn.innerHTML = '<span>Error</span>';
    submitBtn.style.background = '#ef4444';
    alert('Network error. Please check your connection and try again.');
  }

  // Reset button after delay
  setTimeout(() => {
    submitBtn.innerHTML = originalText;
    submitBtn.style.background = '';
    submitBtn.disabled = false;
  }, 3000);
}

// =============================================
// Performance Optimizations
// =============================================

// Pause animation when tab is not visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
  } else {
    animate();
  }
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (renderer) {
    renderer.dispose();
  }
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
});
