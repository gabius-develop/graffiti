// ===== AURORA BOREALIS BACKGROUND =====
// Controla las ondas de aurora: velocidad, amplitud, color, etc.
(function initAurora() {
    const canvas = document.getElementById('aurora-canvas');
    const ctx = canvas.getContext('2d');
    let width, height;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    // Aurora wave parameters (speed controla velocidad de cada onda)
    const waves = [
        { color: [0, 255, 130], speed: 0.001, amplitude: 0.15, frequency: 0.8, yOffset: 0.35, opacity: 0.12 },
        { color: [0, 200, 255], speed: 0.001, amplitude: 0.12, frequency: 1.2, yOffset: 0.40, opacity: 0.10 },
        { color: [120, 0, 255], speed: 0.004, amplitude: 0.10, frequency: 0.6, yOffset: 0.30, opacity: 0.08 },
        { color: [0, 255, 200], speed: 0.0010, amplitude: 0.18, frequency: 1.0, yOffset: 0.45, opacity: 0.09 },
        { color: [200, 50, 255], speed: 0.0015, amplitude: 0.08, frequency: 1.5, yOffset: 0.25, opacity: 0.07 },
    ];

    let time = 0;

    function drawAurora() {
        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, '#020010');
        skyGrad.addColorStop(0.4, '#050520');
        skyGrad.addColorStop(0.7, '#0a0a2e');
        skyGrad.addColorStop(1, '#0d0d1a');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        drawStars();

        for (const wave of waves) {
            drawWave(wave, time);
        }

        time++;
        requestAnimationFrame(drawAurora);
    }

    const stars = [];
    function generateStars() {
        stars.length = 0;
        for (let i = 0; i < 150; i++) {
            stars.push({
                x: Math.random(),
                y: Math.random() * 0.7,
                size: Math.random() * 1.5 + 0.5,
                twinkleSpeed: Math.random() * 0.02 + 0.005,
                twinkleOffset: Math.random() * Math.PI * 2,
            });
        }
    }
    generateStars();

    function drawStars() {
        for (const star of stars) {
            const alpha = 0.3 + 0.7 * Math.abs(Math.sin(time * star.twinkleSpeed + star.twinkleOffset));
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function drawWave(wave, t) {
        const [r, g, b] = wave.color;
        const segments = 80;

        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let i = 0; i <= segments; i++) {
            const x = (i / segments) * width;
            const normalX = i / segments;
            const y = height * wave.yOffset +
                Math.sin(normalX * Math.PI * wave.frequency * 2 + t * wave.speed * 60) * height * wave.amplitude * 0.5 +
                Math.sin(normalX * Math.PI * wave.frequency * 3 + t * wave.speed * 40) * height * wave.amplitude * 0.3 +
                Math.cos(normalX * Math.PI * wave.frequency + t * wave.speed * 20) * height * wave.amplitude * 0.2;
            ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, height * (wave.yOffset - wave.amplitude), 0, height * (wave.yOffset + 0.3));
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
        grad.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${wave.opacity})`);
        grad.addColorStop(0.6, `rgba(${r}, ${g}, ${b}, ${wave.opacity * 0.6})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

        ctx.fillStyle = grad;
        ctx.fill();
    }

    drawAurora();
})();


// =============================================================================
// ===== PLANETA 3D (modelo GLB) - gira sobre su eje al mantener click    =====
// ===== Modelo cargado: models/little_planet_earth.glb                    =====
// =============================================================================
(function initPlanet() {
    const wrapper = document.getElementById('planet-wrapper');
    const canvas = document.getElementById('planet-canvas');

    const size = wrapper.clientWidth || 280;

    // Three.js scene for the planet
    const scene = new THREE.Scene();
    // Camera: framing planet + orbiting logos inside canvas
    const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
    camera.position.set(0, 0.8, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting for the planet
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(3, 2, 4);
    scene.add(sunLight);

    const rimLight = new THREE.PointLight(0x4488ff, 0.4, 10);
    rimLight.position.set(-3, 1, -2);
    scene.add(rimLight);

    // Solar system group: contains planet + all orbiting logos
    // Rotating this group with the mouse moves EVERYTHING together
    const solarSystem = new THREE.Group();
    scene.add(solarSystem);

    let planetPivot = null;
    let isHolding = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let baseRotateX = 0;
    let baseRotateY = 0;

    // Orbiting tech logos
    const orbitModels = [];

    const loader = new THREE.GLTFLoader();

    // Load planet GLB
    loader.load('models/little_planet_earth.glb', (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const modelSize = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);

        // Planet size (centered, leaves room for orbiting logos)
        const scale = 1.6 / maxDim;
        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        planetPivot = new THREE.Group();
        planetPivot.add(model);
        solarSystem.add(planetPivot);

        // Load orbiting tech logos after planet is ready
        loadOrbitLogos();

    }, undefined, (error) => {
        console.error('Error loading planet model:', error);
    });

    // 4 tech logos orbiting the planet, each on a different orbital plane
    function loadOrbitLogos() {
        const logos = [
            { file: 'models/html_logo__3d_model.glb',       orbitRadius: 1.8, speed: 0.7,  tiltX: 0.2,  tiltZ: 0.05, startAngle: 0 },
            { file: 'models/css_logo_3d_model.glb',          orbitRadius: 2.0, speed: 0.55, tiltX: -0.15, tiltZ: 0.25, startAngle: Math.PI * 0.5 },
            { file: 'models/javascript_logo__3d_model.glb',  orbitRadius: 2.2, speed: 0.45, tiltX: 0.1,  tiltZ: -0.2, startAngle: Math.PI },
            { file: 'models/typescript_logo__3d_model.glb',  orbitRadius: 2.4, speed: 0.35, tiltX: -0.25, tiltZ: 0.15, startAngle: Math.PI * 1.5 },
        ];

        logos.forEach((logo) => {
            loader.load(logo.file, (gltf) => {
                const model = gltf.scene;

                // Center and scale the logo
                const box = new THREE.Box3().setFromObject(model);
                const center = box.getCenter(new THREE.Vector3());
                const modelSize = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
                const scale = 0.45 / maxDim;

                model.scale.setScalar(scale);
                model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

                // Each logo has its own orbital plane (tilted group)
                const orbitPlane = new THREE.Group();
                orbitPlane.rotation.x = logo.tiltX;
                orbitPlane.rotation.z = logo.tiltZ;

                const logoPivot = new THREE.Group();
                logoPivot.add(model);
                orbitPlane.add(logoPivot);
                solarSystem.add(orbitPlane);

                orbitModels.push({
                    pivot: logoPivot,
                    plane: orbitPlane,
                    radius: logo.orbitRadius,
                    speed: logo.speed,
                    startAngle: logo.startAngle,
                    selfSpin: 1.5 + Math.random(),
                });
            }, undefined, (err) => {
                console.error('Error loading logo:', logo.file, err);
            });
        });
    }

    // Mouse interaction - spin on own axis
    canvas.addEventListener('mousedown', (e) => {
        isHolding = true;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
        velocityX = 0;
        velocityY = 0;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!isHolding) return;
        const dx = e.clientX - lastMouseX;
        const dy = e.clientY - lastMouseY;
        velocityY = dx * 0.005;
        velocityX = dy * 0.005;
        baseRotateY += velocityY;
        baseRotateX += velocityX;
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => { isHolding = false; });

    // Touch interaction
    canvas.addEventListener('touchstart', (e) => {
        isHolding = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
        velocityX = 0;
        velocityY = 0;
        e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!isHolding) return;
        const touch = e.touches[0];
        const dx = touch.clientX - lastMouseX;
        const dy = touch.clientY - lastMouseY;
        velocityY = dx * 0.005;
        velocityX = dy * 0.005;
        baseRotateY += velocityY;
        baseRotateX += velocityX;
        lastMouseX = touch.clientX;
        lastMouseY = touch.clientY;
    }, { passive: true });

    window.addEventListener('touchend', () => { isHolding = false; });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        const t = Date.now() * 0.001;

        // Momentum when not holding
        if (!isHolding) {
            baseRotateY += velocityY;
            baseRotateX += velocityX;
            velocityX *= 0.97;
            velocityY *= 0.97;
        }

        // Slow auto-rotation when idle
        if (Math.abs(velocityX) < 0.0001 && Math.abs(velocityY) < 0.0001 && !isHolding) {
            baseRotateY += 0.003;
        }

        // Float up and down (subtle)
        const floatY = Math.sin(t * Math.PI * 0.5) * 0.1;

        // Rotate the entire solar system (planet + all logos move together)
        solarSystem.rotation.x = baseRotateX;
        solarSystem.rotation.y = baseRotateY;
        solarSystem.position.y = floatY;

        // Planet self-spin (slow additional rotation)
        if (planetPivot) {
            planetPivot.rotation.y = t * 0.15;
        }

        // Animate orbiting tech logos within the solar system
        for (const orb of orbitModels) {
            const angle = orb.startAngle + t * orb.speed;
            orb.pivot.position.x = Math.cos(angle) * orb.radius;
            orb.pivot.position.z = Math.sin(angle) * orb.radius;
            orb.pivot.position.y = 0;

            // Self-rotation (each logo spins on its own axis)
            orb.pivot.rotation.y = t * orb.selfSpin;
            orb.pivot.rotation.x = Math.sin(t * 0.5 + orb.startAngle) * 0.3;
        }

        renderer.render(scene, camera);
    }

    animate();

    // Resize
    function onResize() {
        const s = wrapper.clientWidth;
        if (s > 0) {
            renderer.setSize(s, s);
        }
    }
    window.addEventListener('resize', onResize);
})();


// ===== PLAY BUTTON =====
(function initPlayButton() {
    const playBtn = document.getElementById('play-btn');
    const overlay = document.getElementById('character-overlay');
    const msnContainer = document.getElementById('msn-container');
    let isShowing = false;

    playBtn.addEventListener('click', () => {
        if (isShowing) {
            overlay.classList.remove('active');
            msnContainer.classList.remove('active');
            isShowing = false;
        } else {
            overlay.classList.add('active');
            msnContainer.classList.add('active');
            isShowing = true;
        }
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
            msnContainer.classList.remove('active');
            isShowing = false;
        }
    });
})();


// =============================================================================
// ===== MSN MESSENGER 3D MODELS (bottom-left, two intertwined, clickable) =====
// ===== Al hacer click en un modelo, se abre la ventana MSN Messenger     =====
// =============================================================================
(function initMSN() {
    const container = document.getElementById('msn-container');
    const canvas = document.getElementById('msn-canvas');

    // Three.js setup
    const scene = new THREE.Scene();

    const msnCanvas = document.getElementById('msn-canvas');
    const size = msnCanvas.clientWidth || 200;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 1, 4);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 3, 2);
    scene.add(dirLight);

    const pointLight1 = new THREE.PointLight(0x44ff88, 0.5, 10);
    pointLight1.position.set(-1, 2, 1);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x4488ff, 0.5, 10);
    pointLight2.position.set(1, 2, -1);
    scene.add(pointLight2);

    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    let model1 = null;
    let model2 = null;
    let pivot1 = null;
    let pivot2 = null;

    // Tint all meshes in a model to a given color
    function tintModel(model, color) {
        model.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material = child.material.clone();
                child.material.color.multiply(new THREE.Color(color));
                if (child.material.emissive) {
                    child.material.emissive.set(color);
                    child.material.emissiveIntensity = 0.15;
                }
            }
        });
    }

    const loader = new THREE.GLTFLoader();
    loader.load('models/msn_character.glb', (gltf) => {
        const original = gltf.scene;

        // Auto-center and scale
        const box = new THREE.Box3().setFromObject(original);
        const center = box.getCenter(new THREE.Vector3());
        const modelSize = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        const scale = 1.2 / maxDim;

        // Model 1 - GREEN tint
        model1 = original.clone();
        model1.scale.setScalar(scale);
        model1.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        tintModel(model1, 0x44ff66);

        // Model 2 - BLUE tint
        model2 = original.clone();
        model2.scale.setScalar(scale);
        model2.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        tintModel(model2, 0x4488ff);

        // Create pivot groups for orbiting
        pivot1 = new THREE.Group();
        pivot1.add(model1);
        pivot1.userData.name = 'green';
        scene.add(pivot1);

        pivot2 = new THREE.Group();
        pivot2.add(model2);
        pivot2.userData.name = 'blue';
        scene.add(pivot2);

    }, undefined, (error) => {
        console.error('Error loading GLB model:', error);
    });

    let isHovered = false;

    // =========================================================================
    // CLICK en modelos MSN → abre la ventana MSN Messenger
    // Para cambios manuales: busca "onMsnButtonClick" más abajo
    // =========================================================================
    canvas.addEventListener('click', (e) => {
        if (!model1 || !model2) return;

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            let clickedObj = intersects[0].object;
            while (clickedObj.parent && clickedObj.parent !== scene) {
                clickedObj = clickedObj.parent;
            }

            const name = clickedObj.userData.name;
            if (name === 'green' || name === 'blue') {
                onMsnButtonClick(name);
            }
        }
    });

    // Hover cursor
    canvas.addEventListener('mousemove', (e) => {
        if (!model1 || !model2) return;

        const rect = canvas.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects.length > 0) {
            canvas.style.cursor = 'pointer';
            isHovered = true;
        } else {
            canvas.style.cursor = 'default';
            isHovered = false;
        }
    });

    // =========================================================================
    // onMsnButtonClick - handler del click en modelos MSN
    // Aquí se abre la ventana MSN Messenger y se configura el usuario
    // =========================================================================
    function onMsnButtonClick(color) {
        // Visual feedback: quick scale bounce
        const pivot = color === 'green' ? pivot1 : pivot2;
        if (!pivot) return;

        const origScale = pivot.scale.x;
        pivot.scale.setScalar(origScale * 1.5);
        setTimeout(() => {
            pivot.scale.setScalar(origScale);
        }, 200);

        // Open the MSN chat window
        openMsnWindow(color);
    }

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);

        if (pivot1 && pivot2) {
            const t = Date.now() * 0.001;

            const orbitRadius = 0.6;
            const orbitSpeed = 1.5;
            const hoverScale = isHovered ? 1.05 : 1.0;

            // Model 1 (green) orbit
            pivot1.position.x = Math.cos(t * orbitSpeed) * orbitRadius;
            pivot1.position.z = Math.sin(t * orbitSpeed) * orbitRadius * 0.5;
            pivot1.position.y = Math.sin(t * orbitSpeed * 2) * 0.2 + 0.5;
            pivot1.rotation.y = t * 2;
            pivot1.scale.setScalar(hoverScale);

            // Model 2 (blue) orbit (offset by PI)
            pivot2.position.x = Math.cos(t * orbitSpeed + Math.PI) * orbitRadius;
            pivot2.position.z = Math.sin(t * orbitSpeed + Math.PI) * orbitRadius * 0.5;
            pivot2.position.y = Math.sin((t * orbitSpeed + Math.PI) * 2) * 0.2 + 0.5;
            pivot2.rotation.y = -t * 2;
            pivot2.scale.setScalar(hoverScale);
        }

        renderer.render(scene, camera);
    }

    animate();

    // Resize
    function onResize() {
        const s = msnCanvas.clientWidth;
        if (s > 0) {
            renderer.setSize(s, s);
        }
    }
    window.addEventListener('resize', onResize);
})();


// =============================================================================
// ===== VENTANA MSN MESSENGER (chat window)                               =====
// ===== Se abre al hacer click en los modelos MSN verde/azul              =====
// ===== Para modificar manualmente: busca "openMsnWindow" y "msn-close"   =====
// =============================================================================
(function initMsnWindow() {
    const overlay = document.getElementById('msn-window-overlay');
    const closeBtn = document.getElementById('msn-close-btn');
    const sendBtn = document.getElementById('msn-send-btn');
    const input = document.getElementById('msn-input');
    const messagesDiv = document.getElementById('msn-messages');
    const toUser = document.getElementById('msn-to-user');

    let currentColor = '';

    // Expose globally so MSN models can call it
    window.openMsnWindow = function(color) {
        currentColor = color;
        const userName = color === 'green' ? 'MSN Buddy (Green)' : 'MSN Buddy (Blue)';
        toUser.textContent = userName;
        messagesDiv.innerHTML = '';
        addSystemMessage(userName + ' se ha conectado.');
        overlay.classList.add('active');
        setTimeout(() => input.focus(), 500);
    };

    // Close button (the × in the title bar)
    closeBtn.addEventListener('click', () => {
        overlay.classList.remove('active');
    });

    // Close clicking outside the window
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });

    // Send message
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        addMessage('Tú', text);
        input.value = '';

        // Auto-reply after a short delay
        setTimeout(() => {
            const replies = [
                '¡Hola! ¿Cómo estás? 😊',
                'jajaja qué buena onda!',
                '¿Te acuerdas del MSN? Qué tiempos...',
                '*zumbido* 📳',
                '¿Ya viste mi nuevo avatar?',
                'BRB 🏃',
                'xD LOL',
                'Agregame a tus contactos!',
                '¿Escuchaste la canción que puse en mi perfil?',
                '(L) (K) (H)',
                'Aparezco como no disponible pero sí estoy 😅',
            ];
            const reply = replies[Math.floor(Math.random() * replies.length)];
            const name = currentColor === 'green' ? 'MSN Buddy (Green)' : 'MSN Buddy (Blue)';
            addMessage(name, reply);
        }, 800 + Math.random() * 1200);
    }

    function addMessage(user, text) {
        const msg = document.createElement('div');
        msg.className = 'msg';
        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        msg.innerHTML = `<span class="msg-user">${user}</span><span class="msg-time">${timeStr}</span><br>${text}`;
        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function addSystemMessage(text) {
        const msg = document.createElement('div');
        msg.className = 'msg';
        msg.style.color = '#888';
        msg.style.fontStyle = 'italic';
        msg.textContent = text;
        messagesDiv.appendChild(msg);
    }
})();


// =============================================================================
// ===== DUENDE CLICK → EXPLOSIÓN BOOMBOX → LEYENDA "MENU"                =====
// ===== Modelo: models/boombox.glb                                        =====
// ===== Al hacer click en el duende, se reproduce el modelo como explosión =====
// ===== Cuando termina, el duende desaparece y aparece "MENU"             =====
// =============================================================================
(function initDuendeExplosion() {
    const duendeImg = document.getElementById('character-img');
    const explosionCanvas = document.getElementById('explosion-canvas');
    const menuLabel = document.getElementById('menu-label');
    const speechBubble = document.getElementById('speech-bubble');

    let hasExploded = false;
    let explosionScene, explosionCamera, explosionRenderer;
    let boomboxModel = null;
    let mixer = null;
    let particles = [];
    let explosionActive = false;
    let explosionStartTime = 0;
    const EXPLOSION_DURATION = 2000; // ms

    // Pre-load boombox model
    const loader = new THREE.GLTFLoader();
    loader.load('models/boombox.glb', (gltf) => {
        boomboxModel = gltf;
    }, undefined, (error) => {
        console.error('Error loading boombox model:', error);
    });

    // Setup Three.js scene for explosion (only once)
    function setupExplosionScene() {
        explosionScene = new THREE.Scene();
        explosionCamera = new THREE.PerspectiveCamera(50, 1, 0.01, 100);
        explosionCamera.position.set(0, 0, 3);
        explosionCamera.lookAt(0, 0, 0);

        explosionRenderer = new THREE.WebGLRenderer({
            canvas: explosionCanvas,
            alpha: true,
            antialias: true
        });
        explosionRenderer.setSize(300, 300);
        explosionRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Bright lighting for explosion
        explosionScene.add(new THREE.AmbientLight(0xffffff, 1.0));
        const light = new THREE.PointLight(0xff6600, 2, 10);
        light.position.set(0, 1, 2);
        explosionScene.add(light);
    }

    // Create particle explosion effect using copies of the boombox
    function startExplosion() {
        if (!boomboxModel) return;

        setupExplosionScene();
        explosionCanvas.classList.add('active');
        explosionActive = true;
        explosionStartTime = Date.now();
        particles = [];

        const original = boomboxModel.scene;

        // Measure and center
        const box = new THREE.Box3().setFromObject(original);
        const center = box.getCenter(new THREE.Vector3());
        const modelSize = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);

        // Create multiple copies flying outward like an explosion
        const count = 12;
        for (let i = 0; i < count; i++) {
            const clone = original.clone();
            const scale = (0.3 + Math.random() * 0.4) / maxDim;
            clone.scale.setScalar(scale);
            clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

            const pivot = new THREE.Group();
            pivot.add(clone);
            explosionScene.add(pivot);

            // Random outward direction
            const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const upAngle = (Math.random() - 0.5) * Math.PI;

            particles.push({
                pivot: pivot,
                vx: Math.cos(angle) * (2 + Math.random() * 3),
                vy: Math.sin(upAngle) * (2 + Math.random() * 2),
                vz: Math.sin(angle) * (1 + Math.random() * 2),
                rotSpeed: (Math.random() - 0.5) * 15,
                scale: scale,
            });
        }

        // Add a bright flash sphere
        const flashGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xff8800,
            transparent: true,
            opacity: 1.0
        });
        const flash = new THREE.Mesh(flashGeo, flashMat);
        explosionScene.add(flash);
        particles._flash = flash;
        particles._flashMat = flashMat;

        animateExplosion();
    }

    function animateExplosion() {
        if (!explosionActive) return;

        const elapsed = Date.now() - explosionStartTime;
        const progress = Math.min(elapsed / EXPLOSION_DURATION, 1);

        // Move particles outward
        const dt = 0.016;
        for (const p of particles) {
            p.pivot.position.x += p.vx * dt;
            p.pivot.position.y += p.vy * dt;
            p.pivot.position.z += p.vz * dt;
            p.pivot.rotation.x += p.rotSpeed * dt;
            p.pivot.rotation.z += p.rotSpeed * dt * 0.7;

            // Slow down
            p.vx *= 0.97;
            p.vy *= 0.97;
            p.vz *= 0.97;

            // Fade out by scaling down
            const fade = 1 - progress;
            p.pivot.scale.setScalar(fade);
        }

        // Flash: expand and fade
        if (particles._flash) {
            const flashProgress = Math.min(elapsed / 400, 1);
            particles._flash.scale.setScalar(1 + flashProgress * 4);
            particles._flashMat.opacity = 1 - flashProgress;
        }

        explosionRenderer.render(explosionScene, explosionCamera);

        if (progress < 1) {
            requestAnimationFrame(animateExplosion);
        } else {
            // Explosion finished - clean up and show MENU
            finishExplosion();
        }
    }

    function finishExplosion() {
        explosionActive = false;
        explosionCanvas.classList.remove('active');

        // Hide duende and speech bubble
        duendeImg.classList.add('hidden');
        speechBubble.style.display = 'none';

        // Show MENU label
        menuLabel.classList.add('active');
    }

    // Click on duende triggers explosion
    duendeImg.addEventListener('click', (e) => {
        if (hasExploded || !boomboxModel) return;
        hasExploded = true;
        e.stopPropagation();

        // Stop bouncing immediately
        duendeImg.style.animation = 'none';

        // Quick shake before exploding
        duendeImg.style.transition = 'transform 0.05s ease';
        let shakeCount = 0;
        const shakeInterval = setInterval(() => {
            const offsetX = (Math.random() - 0.5) * 20;
            const offsetY = (Math.random() - 0.5) * 20;
            duendeImg.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
            shakeCount++;
            if (shakeCount > 12) {
                clearInterval(shakeInterval);
                duendeImg.style.transform = '';
                duendeImg.style.opacity = '0';
                startExplosion();
            }
        }, 50);
    });

    // MENU label click → show sections, hide play button
    menuLabel.addEventListener('click', () => {
        const mainContainer = document.querySelector('.main-container');
        const sectionsBar = document.getElementById('sections-bar');

        mainContainer.classList.toggle('menu-open');
        sectionsBar.classList.toggle('active');

        // Initialize section models on first open
        if (!window._sectionsInitialized) {
            window._sectionsInitialized = true;
            initSectionModels();
        }
    });
})();


// =============================================================================
// ===== SECCIONES DEL MENÚ (modelos 3D en cada tarjeta)                   =====
// ===== Estructura dinámica: alimentada desde data-attributes o DB        =====
// ===== Para agregar secciones desde DB: usa renderSections() más abajo   =====
// =============================================================================

// Initialize 3D models for each section card
function initSectionModels() {
    const cards = document.querySelectorAll('.section-card');

    cards.forEach((card) => {
        const canvas = card.querySelector('.section-canvas');
        const modelPath = card.dataset.model;
        const rotationType = card.dataset.rotation || 'default';
        if (!modelPath) return;

        setupSectionScene(canvas, modelPath, rotationType);
    });
}

// Creates a mini Three.js scene for a section card
// rotationType: 'default' = Y rotation, 'xy' = X+Y rotation, 'spin' = fast spin
function setupSectionScene(canvas, modelPath, rotationType) {
    rotationType = rotationType || 'default';
    const size = canvas.clientWidth || 120;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 100);
    camera.position.set(0, 0.5, 3);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(2, 2, 3);
    scene.add(dirLight);
    const rimLight = new THREE.PointLight(0x2ecc71, 0.3, 8);
    rimLight.position.set(-2, 1, 1);
    scene.add(rimLight);

    let pivot = null;

    const loader = new THREE.GLTFLoader();
    loader.load(modelPath, (gltf) => {
        const model = gltf.scene;

        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const modelSize = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(modelSize.x, modelSize.y, modelSize.z);
        const scale = 1.5 / maxDim;

        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

        pivot = new THREE.Group();
        pivot.add(model);
        scene.add(pivot);
    }, undefined, (err) => {
        console.error('Error loading section model:', modelPath, err);
    });

    function animate() {
        requestAnimationFrame(animate);
        if (pivot) {
            if (rotationType === 'xy') {
                // Rotate on both X and Y axes simultaneously
                pivot.rotation.y += 0.01;
                pivot.rotation.x += 0.01;
            } else {
                // Default: Y rotation with subtle X wobble
                pivot.rotation.y += 0.01;
                pivot.rotation.x = Math.sin(Date.now() * 0.001) * 0.1;
            }
        }
        renderer.render(scene, camera);
    }
    animate();

    // Resize
    function onResize() {
        const s = canvas.clientWidth;
        if (s > 0) {
            renderer.setSize(s, s);
        }
    }
    window.addEventListener('resize', onResize);
}

// =============================================================================
// ===== renderSections() - Función para alimentar secciones desde una DB  =====
// ===== Llama esta función pasándole un array de objetos con la estructura =====
// ===== que se muestra en el ejemplo de abajo.                            =====
// =============================================================================
//
// Ejemplo de uso:
//
//   renderSections([
//     { id: 'hacking',  label: 'Hacking', model: 'models/old_hacking_pc.glb' },
//     { id: 'musica',   label: 'Musica',  model: 'models/music_cassette.glb' },
//     { id: 'blog',     label: 'Blog',    model: 'models/3d_low_poly_catroon_items_with_eyes_and_mouth.glb' },
//     { id: 'nuevo',    label: 'Nuevo',   model: 'models/nuevo_modelo.glb' },
//   ]);
//
window.renderSections = function(sections) {
    const bar = document.getElementById('sections-bar');
    bar.innerHTML = '';

    sections.forEach((sec) => {
        const card = document.createElement('div');
        card.className = 'section-card';
        card.dataset.section = sec.id;
        card.dataset.model = sec.model;

        const canvas = document.createElement('canvas');
        canvas.className = 'section-canvas';

        const label = document.createElement('span');
        label.className = 'section-label';
        label.textContent = sec.label;

        card.appendChild(canvas);
        card.appendChild(label);
        bar.appendChild(card);

        // Click handler for each dynamic section
        card.addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('section-click', {
                detail: { id: sec.id, label: sec.label, model: sec.model }
            }));
            console.log(`Section clicked: ${sec.id}`);
        });

        card.dataset.rotation = sec.rotation || 'default';

        // Setup 3D scene for this card
        requestAnimationFrame(() => {
            setupSectionScene(canvas, sec.model, sec.rotation || 'default');
        });
    });
};

// Click handler for static HTML section cards
document.querySelectorAll('.section-card').forEach((card) => {
    card.addEventListener('click', () => {
        const sectionId = card.dataset.section;
        window.dispatchEvent(new CustomEvent('section-click', {
            detail: { id: sectionId, label: card.querySelector('.section-label').textContent }
        }));
        console.log(`Section clicked: ${sectionId}`);
    });
});
