const throttle = require('lodash.throttle');
const Color = require('color');
const nameToHex = require('convert-css-color-name-to-hex');
const toHex = (str) => Color(nameToHex(str)).hexString();
const values = require('lodash.values');

// Constants for the particle simulation.
const MAX_PARTICLES = 300;

const BLOOD_GRAVITY = 0.075;
const BLOOD_CHANCE = .33
const BLOOD_SIZE = 3;
const BLOOD_AMOUNT = 10
const BLOOD_FADE = .96;
const BLOOD_POOL = true
const DROP_MAX = 7
const DROP_MIN = 4 // Must be greater than bloodSize
const BIGDROP_CHANCE = .30

const PARTICLE_VELOCITY_RANGE = {
  x: [-0.01, 0.01],
  y: [1, 2]
};

exports.decorateTerm = (Term, { React, notify }) => {
  // Define and return our higher order component.
  return class extends React.Component {
    constructor(props, context) {
      super(props, context);
      // Since we'll be passing these functions around, we need to bind this 
      // to each.
      this._drawFrame = this._drawFrame.bind(this);
      this._resizeCanvas = this._resizeCanvas.bind(this);
      this._onDecorated = this._onDecorated.bind(this);
      this._onCursorMove = this._onCursorMove.bind(this);
      this.createBloodDrip = throttle(this.createBloodDrip.bind(this), 25, { trailing: false });
      // Initial particle state
      this._particles = [];
      // We'll set these up when the terminal is available in `_onDecorated`
      this._div = null;
      this._canvas = null;
    }

    _onDecorated (term) {
      if (this.props.onDecorated) this.props.onDecorated(term);
      this._div = term.termRef;  
      this._initCanvas();
    }

    // Set up our canvas element we'll use to do particle effects on.
    _initCanvas() {
      this._canvas = document.createElement('canvas');
      this._canvas.style.position = 'absolute';
      this._canvas.style.top = '0';
      this._canvas.style.pointerEvents = 'none';
      this._canvasContext = this._canvas.getContext('2d');
      this._canvas.width = window.innerWidth;
      this._canvas.height = window.innerHeight;
      document.body.appendChild(this._canvas);
      window.requestAnimationFrame(this._drawFrame);
      window.addEventListener('resize', this._resizeCanvas);
    }

    _resizeCanvas() {
      this._canvas.width = window.innerWidth;
      this._canvas.height = window.innerHeight;
    }

    // Draw the next frame in the particle simulation.
    _drawFrame() {
      // Clear only if there is some existing particles.
      this._particles.length && this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._particles.forEach((particle) => {
        if(BLOOD_POOL){
          if (particle.y < window.innerHeight * .99) {
            // Falling
            particle.velocity.y += BLOOD_GRAVITY;
            particle.x += particle.velocity.x;
            particle.y += particle.velocity.y;
          }else{
            // Pooling 
            particle.x += particle.velocity.x*100;
            particle.alpha *= 0.99;
            // particle.y -= particle.velocity.y;
          }
        }else{
            particle.x += particle.velocity.x;
            particle.y += particle.velocity.y;
            particle.alpha *= BLOOD_FADE;
        }
        
        this._canvasContext.fillStyle = `rgba(${particle.color.join(',')}, ${particle.alpha})`;
        this._canvasContext.fillRect(Math.round(particle.x - 1)-(particle.size/2), Math.round(particle.y - 1), particle.size, particle.size);
      });
      this._particles = this._particles
        .slice(Math.max(this._particles.length - MAX_PARTICLES, 0))
        .filter((particle) => particle.alpha > 0.1);
      window.requestAnimationFrame(this._drawFrame);
    }

    // Pushes `PARTICLE_NUM_RANGE` new particles into the simulation.
    createBloodDrip(x, y) {
      const numParticles = BLOOD_AMOUNT + Math.round(Math.random() * BLOOD_AMOUNT);
      const colorCode = toHex('red')
      const r = parseInt(colorCode.slice(1, 3), 16);
      const g = parseInt(colorCode.slice(3, 5), 16);
      const b = parseInt(colorCode.slice(5, 7), 16);
      const color = [r, g, b];
      for (let i = 0; i < numParticles; i++) {
        if(i==0){
          this._particles.push(this.createBloodParticle(x, y, color, true));
        }else{
          this._particles.push(this.createBloodParticle(x, y, color));
        }
      }
    }

    createBloodParticle(x, y, color, bigdrop) {
      let velocity = null
      let size = null
      if(bigdrop == true){
        velocity = {
          x: PARTICLE_VELOCITY_RANGE.x[0] + Math.random() *
            (PARTICLE_VELOCITY_RANGE.x[1] - PARTICLE_VELOCITY_RANGE.x[0]),
          y: PARTICLE_VELOCITY_RANGE.y[1]
        }
        size = Math.random() * (DROP_MAX - DROP_MIN) + DROP_MIN;
      }else{
        velocity = {
          x: PARTICLE_VELOCITY_RANGE.x[0] + Math.random() *
            (PARTICLE_VELOCITY_RANGE.x[1] - PARTICLE_VELOCITY_RANGE.x[0]),
          y: PARTICLE_VELOCITY_RANGE.y[0] + Math.random() *
            (PARTICLE_VELOCITY_RANGE.y[1] - PARTICLE_VELOCITY_RANGE.y[0])
        }
        size = BLOOD_SIZE
      }
      return {
        x: x,
        y: y,
        alpha: 1,
        color,
        size,
        velocity: velocity
      };
    }

    _onCursorMove (cursorFrame) {
      if (this.props.onCursorMove) this.props.onCursorMove(cursorFrame);
      const { x, y } = cursorFrame;      
      const origin = this._div.getBoundingClientRect();
      const drip = Math.random() < BLOOD_CHANCE
      if(drip){
        requestAnimationFrame(() => {
          this.createBloodDrip(x + origin.left, y + origin.top);
        });
      }
    }

    render() {
      // Return the default Term component with our custom onTerminal closure
      // setting up and managing the particle effects.
      return React.createElement(Term, Object.assign({}, this.props, {
        onDecorated: this._onDecorated,
        onCursorMove: this._onCursorMove
      }));
    }

    componentWillUnmount() {
      document.body.removeChild(this._canvas);
    }

  }
};
