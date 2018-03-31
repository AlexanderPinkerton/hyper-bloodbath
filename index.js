const throttle = require('lodash.throttle');
const Color = require('color');
const nameToHex = require('convert-css-color-name-to-hex');
const toHex = (str) => Color(nameToHex(str)).hexString();
const values = require('lodash.values');

// Constants for the particle simulation.
const MAX_PARTICLES = 500;
const BLOOD_GRAVITY = 0.075;

const BLOOD_SPEED = 1
const BLOOD_SIZE = 3;
const BLOOD_AMOUNT = 10
const BLOOD_FADE = .96;
const BLOOD_POOL = true

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
      this._onTerminal = this._onTerminal.bind(this);
      this._onCursorChange = this._onCursorChange.bind(this);
      this._spawnParticles = throttle(this._spawnParticles.bind(this), 25, { trailing: false });
      // Initial particle state
      this._particles = [];
      // We'll set these up when the terminal is available in `_onTerminal`
      this._div = null;
      this._cursor = null;
      this._observer = null;
      this._canvas = null;
    }

    _onTerminal(term) {
      if (this.props.onTerminal) this.props.onTerminal(term);
      this._div = term.div_;
      this._cursor = term.cursorNode_;
      this._window = term.document_.defaultView;
      // We'll need to observe cursor change events.
      this._observer = new MutationObserver(this._onCursorChange);
      this._observer.observe(this._cursor, {
        attributes: true,
        childList: false,
        characterData: false
      });
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
      this._window.requestAnimationFrame(this._drawFrame);
      this._window.addEventListener('resize', this._resizeCanvas);
    }

    _resizeCanvas() {
      this._canvas.width = window.innerWidth;
      this._canvas.height = window.innerHeight;
    }

    // Draw the next frame in the particle simulation.
    _drawFrame() {
      this._canvasContext.clearRect(0, 0, this._canvas.width, this._canvas.height);
      this._particles.forEach((particle) => {
        particle.velocity.y += BLOOD_GRAVITY;

        if(BLOOD_POOL){
          if (particle.y < window.innerHeight * .99) {
            // Falling
            particle.x += particle.velocity.x;
            particle.y += particle.velocity.y;
          }else{
            // Pooling 
            particle.x += particle.velocity.x*100;
            particle.alpha *= .98;
          }
        }else{
            particle.x += particle.velocity.x;
            particle.y += particle.velocity.y;
            particle.alpha *= BLOOD_FADE;
        }
        
        this._canvasContext.fillStyle = `rgba(${particle.color.join(',')}, ${particle.alpha})`;
        this._canvasContext.fillRect(Math.round(particle.x - 1), Math.round(particle.y - 1), BLOOD_SIZE, BLOOD_SIZE);
      });
      this._particles = this._particles
        .slice(Math.max(this._particles.length - MAX_PARTICLES, 0))
        .filter((particle) => particle.alpha > 0.1);
      this._window.requestAnimationFrame(this._drawFrame);
    }

    // Pushes `PARTICLE_NUM_RANGE` new particles into the simulation.
    _spawnParticles(x, y) {
      const numParticles = BLOOD_AMOUNT + Math.round(Math.random() * BLOOD_AMOUNT);
      const colorCode = toHex('red')
      const r = parseInt(colorCode.slice(1, 3), 16);
      const g = parseInt(colorCode.slice(3, 5), 16);
      const b = parseInt(colorCode.slice(5, 7), 16);
      const color = [r, g, b];
      for (let i = 0; i < numParticles; i++) {
        this._particles.push(this._createParticle(x, y, color));
      }
    }

    _createParticle(x, y, color) {
      return {
        x,
        y: y,
        alpha: 1,
        color,
        velocity: {
          x: PARTICLE_VELOCITY_RANGE.x[0] + Math.random() *
            (PARTICLE_VELOCITY_RANGE.x[1] - PARTICLE_VELOCITY_RANGE.x[0]),
          y: PARTICLE_VELOCITY_RANGE.y[0] + Math.random() *
            (PARTICLE_VELOCITY_RANGE.y[1] - PARTICLE_VELOCITY_RANGE.y[0])
        }
      };
    }

    _onCursorChange() {
      // Get current coordinates of the cursor relative the container and 
      // spawn new articles.
      const { top, left } = this._cursor.getBoundingClientRect();
      const origin = this._div.getBoundingClientRect();
      requestAnimationFrame(() => {
        this._spawnParticles(left + origin.left, top + origin.top);
      });
    }

    render() {
      // Return the default Term component with our custom onTerminal closure
      // setting up and managing the particle effects.
      return React.createElement(Term, Object.assign({}, this.props, {
        onTerminal: this._onTerminal
      }));
    }

    componentWillUnmount() {
      document.body.removeChild(this._canvas);
      // Stop observing _onCursorChange
      if (this._observer) {
        this._observer.disconnect();
      }
    }
  }
};
