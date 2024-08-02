const { useState, useRef, useEffect } = React;
const { Canvas, useFrame } = ReactThreeFiber;
const { OrbitControls, TransformControls, Text, Capsule } = drei;

// Componenta pentru corpul pacientului
const PatientBody = () => {
  return (
    <group>
      {/* Tors */}
      <Capsule args={[0.5, 1, 20, 20]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#f4d3a3" />
      </Capsule>
      
      {/* Cap */}
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.3, 32, 32]} />
        <meshStandardMaterial color="#f4d3a3" />
      </mesh>
      
      {/* Brațe */}
      <Capsule args={[0.1, 0.8, 20, 20]} position={[-0.7, 0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <meshStandardMaterial color="#f4d3a3" />
      </Capsule>
      <Capsule args={[0.1, 0.8, 20, 20]} position={[0.7, 0.2, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <meshStandardMaterial color="#f4d3a3" />
      </Capsule>
      
      {/* Picioare */}
      <Capsule args={[0.15, 1, 20, 20]} position={[-0.3, -1.2, 0]}>
        <meshStandardMaterial color="#f4d3a3" />
      </Capsule>
      <Capsule args={[0.15, 1, 20, 20]} position={[0.3, -1.2, 0]}>
        <meshStandardMaterial color="#f4d3a3" />
      </Capsule>
    </group>
  );
};

// Componenta pentru tumoră
const Tumor = ({ position, size }) => (
  <mesh position={position}>
    <sphereGeometry args={[size, 32, 32]} />
    <meshStandardMaterial color="red" transparent opacity={0.7} />
  </mesh>
);

// Componenta pentru fasciculul de radiații
const RadiationBeam = ({ start, end, intensity }) => {
  const beamRef = useRef();

  useFrame(() => {
    // Animația fasciculului
    beamRef.current.material.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.2;
  });

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  direction.normalize();

  const arrow = new THREE.ArrowHelper(direction, start, length, new THREE.Color(1, 1, 0).multiplyScalar(intensity));

  return (
    <primitive object={arrow} ref={beamRef}>
      <meshStandardMaterial color={new THREE.Color(1, 1, 0).multiplyScalar(intensity)} transparent />
    </primitive>
  );
};

// Componenta pentru distribuția dozei
const DoseDistribution = ({ tumorPosition, beamPositions }) => {
  const distributionRef = useRef();

  useEffect(() => {
    // Generarea texturii pentru distribuția dozei
    const size = 64;
    const data = new Uint8Array(size * size * size);
    
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        for (let k = 0; k < size; k++) {
          const index = i * size * size + j * size + k;
          // Calculul dozei în funcție de distanța față de tumoră și fascicule
          let dose = 0;
          const point = new THREE.Vector3(i, j, k).multiplyScalar(2 / size).subScalar(1);
          dose += 1 / (1 + point.distanceTo(tumorPosition) * 10);
          beamPositions.forEach(beamPos => {
            dose += 0.5 / (1 + point.distanceTo(beamPos) * 5);
          });
          data[index] = Math.min(255, Math.floor(dose * 255));
        }
      }
    }

    const texture = new THREE.Data3DTexture(data, size, size, size);
    texture.format = THREE.RedFormat;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.unpackAlignment = 1;
    texture.needsUpdate = true;

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uVolume: { value: texture },
        uDoseThreshold: { value: 0.5 },
      },
      vertexShader: `
        varying vec3 vUv;
        void main() {
          vUv = position * 0.5 + 0.5;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler3D uVolume;
        uniform float uDoseThreshold;
        varying vec3 vUv;
        void main() {
          float dose = texture(uVolume, vUv).r;
          if (dose < uDoseThreshold) discard;
          gl_FragColor = vec4(1.0 - dose, dose, 0.0, dose * 0.5);
        }
      `,
      transparent: true,
    });

    distributionRef.current.material = material;
  }, [tumorPosition, beamPositions]);

  return (
    <mesh ref={distributionRef}>
      <boxGeometry args={[2, 2, 2]} />
    </mesh>
  );
};

// Componenta principală
const AdvancedRadiotherapySimulation = () => {
  const [tumorPosition, setTumorPosition] = useState(new THREE.Vector3(0, 0, 0));
  const [beamPositions, setBeamPositions] = useState([
    new THREE.Vector3(1, 1, 1),
    new THREE.Vector3(-1, -1, -1),
  ]);
  const [beamIntensity, setBeamIntensity] = useState(1);

  useEffect(() => {
    const gui = new dat.GUI();
    const tumorFolder = gui.addFolder('Tumor');
    tumorFolder.add(tumorPosition, 'x', -1, 1);
    tumorFolder.add(tumorPosition, 'y', -1, 1);
    tumorFolder.add(tumorPosition, 'z', -1, 1);
    
    const beamFolder = gui.addFolder('Beam');
    beamFolder.add({ intensity: beamIntensity }, 'intensity', 0, 2).onChange(setBeamIntensity);
    
    return () => gui.destroy();
  }, []);

  return (
    <Canvas camera={{ position: [3, 3, 3] }}>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      
      <PatientBody />
      <Tumor position={tumorPosition} size={0.1} />
      
      {beamPositions.map((pos, index) => (
        <RadiationBeam key={index} start={pos} end={tumorPosition} intensity={beamIntensity} />
      ))}
      
      <DoseDistribution tumorPosition={tumorPosition} beamPositions={beamPositions} />
      
      <OrbitControls />
      <TransformControls object={tumorPosition} mode="translate" />
      
      <Text
        position={[0, 2, 0]}
        color="white"
        fontSize={0.1}
        maxWidth={2}
        textAlign="center"
      >
        Advanced 3D Radiotherapy Simulation
      </Text>
    </Canvas>
  );
};

// Randare
ReactDOM.render(<AdvancedRadiotherapySimulation />, document.getElementById('root'));
