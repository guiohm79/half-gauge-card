/**
 * Half Gauge Card - A simplified 180° gauge card for Home Assistant
 * Version: 1.0.0
 */

class HalfGaugeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('Entity is required');
    }

    this.config = {
      min: 0,
      max: 100,
      leds_count: 50,
      led_size: 10,
      gauge_size: 200,
      decimals: 0,
      animation_duration: 800,
      smooth_transitions: true,
      hide_inactive_leds: false,
      enable_shadow: false,
      center_shadow: false,
      center_shadow_blur: 35,
      center_shadow_spread: 20,
      center_shadow_size: 70,  // Size of center shadow as percentage of gauge radius
      value_position: 'below', // 'below' or 'inside'
      transparent_card: false,
      transparent_gauge: false,
      ...config
    };

    this.previousState = null;
    this.animationInterval = null;
    
    this.render();
  }

  render() {
    const { config } = this;
    const ledsCount = config.leds_count;
    const gaugeSize = config.gauge_size;
    const ledSize = config.led_size;
    const halfSize = gaugeSize / 2;

    const isValueInside = config.value_position === 'inside';
    const centerShadowSize = config.center_shadow_size || 70; // percentage
    const centerRadius = (halfSize - ledSize - 5) * (centerShadowSize / 100);
    
    const cardBg = config.transparent_card ? 'transparent' : (config.card_background || '#222');
    const gaugeBg = config.transparent_gauge ? 'transparent' : (config.gauge_background || 'radial-gradient(circle at center, #444, #222)');
    
    const styles = `
      :host {
        --card-bg: ${cardBg};
        --gauge-bg: ${gaugeBg};
        --text-color: ${config.text_color || '#fff'};
        --unit-color: ${config.unit_color || '#ddd'};
        --title-color: ${config.title_color || '#fff'};
      }
      
      .card {
        background: var(--card-bg);
        border-radius: 16px;
        padding: 20px 20px 15px 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        box-sizing: border-box;
      }
      
      .gauge-svg {
        width: ${gaugeSize}px;
        height: ${halfSize}px;
        display: block;
        overflow: visible;
      }
      
      .gauge-container {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      
      .value-inside {
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        color: var(--text-color);
        pointer-events: none;
      }
      
      .value-inside .value {
        font-size: 32px;
        font-weight: bold;
        line-height: 1;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      
      .value-inside .unit {
        font-size: 12px;
        color: var(--unit-color);
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      
      .value-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: 5px;
        color: var(--text-color);
      }
      
      .value-display .value {
        font-size: 36px;
        font-weight: bold;
        line-height: 1.1;
      }
      
      .value-display .unit {
        font-size: 14px;
        color: var(--unit-color);
        margin-top: 2px;
      }
      
      .title {
        margin-top: 8px;
        font-size: 14px;
        color: var(--title-color);
        text-align: center;
      }
    `;

    // Generate LEDs as SVG circles
    const centerX = halfSize;
    const centerY = halfSize;
    const radius = halfSize - ledSize - 5;

    const ledsSVG = Array.from({ length: ledsCount }, (_, i) => {
      const angle = Math.PI + (i / (ledsCount - 1)) * Math.PI; // 180° to 360° (bottom to bottom through top)
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return `<circle id="led-${i}" cx="${x}" cy="${y}" r="${ledSize/2}" fill="#333" />`;
    }).join('');

    // Value display HTML
    const valueInsideHTML = `
      <div class="value-inside">
        <div class="value" id="value">0</div>
        <div class="unit">${config.unit || ''}</div>
      </div>
    `;
    const valueBelowHTML = `
      <div class="value-display">
        <div class="value" id="value">0</div>
        <div class="unit">${config.unit || ''}</div>
      </div>
    `;

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="card" id="card">
        <div class="gauge-container">
          <svg class="gauge-svg" viewBox="0 0 ${gaugeSize} ${halfSize}">
            <defs>
              <radialGradient id="gaugeBg" cx="50%" cy="100%" r="100%">
                <stop offset="0%" stop-color="#333" />
                <stop offset="100%" stop-color="#222" />
              </radialGradient>
              <filter id="centerGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="${config.center_shadow_blur / 3}" result="blur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="${config.center_shadow_spread / 20}"/>
                </feComponentTransfer>
              </filter>
            </defs>
            <!-- Background arc -->
            <path d="M ${ledSize + 5},${halfSize} A ${radius},${radius} 0 0,1 ${gaugeSize - ledSize - 5},${halfSize}" 
                  fill="none" 
                  stroke="url(#gaugeBg)" 
                  stroke-width="${ledSize + 4}" 
                  stroke-linecap="round"/>
            <!-- Center shadow (filled half-circle) -->
            <path id="center-shadow" 
                  d="M ${centerX - centerRadius},${halfSize} A ${centerRadius},${centerRadius} 0 0,1 ${centerX + centerRadius},${halfSize} Z" 
                  fill="#222" 
                  opacity="0" 
                  filter="url(#centerGlow)"/>
            ${ledsSVG}
          </svg>
          ${isValueInside ? valueInsideHTML : ''}
        </div>
        ${!isValueInside ? valueBelowHTML : ''}
        <div class="title">${config.name || ''}</div>
      </div>
    `;

    // Click handler for more info
    this.shadowRoot.getElementById('card').addEventListener('click', () => {
      const event = new Event('hass-more-info', { bubbles: true, composed: true });
      event.detail = { entityId: config.entity };
      this.dispatchEvent(event);
    });
  }

  getLedColor(value, min, max) {
    const percentage = ((value - min) / (max - min)) * 100;
    const severity = this.config.severity || [
      { color: '#4caf50', value: 33 },
      { color: '#ffeb3b', value: 66 },
      { color: '#f44336', value: 100 }
    ];

    for (const level of severity) {
      if (percentage <= level.value) return level.color;
    }
    return '#555';
  }

  updateGauge(value) {
    const { config } = this;
    const ledsCount = config.leds_count;
    const min = config.min;
    const max = config.max;
    
    const percentage = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
    const activeLeds = Math.round((percentage / 100) * ledsCount);
    const color = this.getLedColor(value, min, max);

    // Update card shadow
    if (config.enable_shadow) {
      this.shadowRoot.querySelector('.card').style.boxShadow = `0 0 25px ${color}`;
    }

    // Update center shadow
    const centerShadow = this.shadowRoot.getElementById('center-shadow');
    if (centerShadow && config.center_shadow) {
      centerShadow.setAttribute('fill', color);
      centerShadow.setAttribute('opacity', '0.7');
    } else if (centerShadow) {
      centerShadow.setAttribute('opacity', '0');
    }

    // Update LEDs
    for (let i = 0; i < ledsCount; i++) {
      const led = this.shadowRoot.getElementById(`led-${i}`);
      if (!led) continue;

      if (i < activeLeds) {
        led.setAttribute('fill', color);
        led.setAttribute('filter', `drop-shadow(0 0 4px ${color})`);
      } else {
        if (config.hide_inactive_leds) {
          led.setAttribute('opacity', '0');
        } else {
          led.setAttribute('fill', '#333');
          led.setAttribute('opacity', '1');
          led.removeAttribute('filter');
        }
      }
    }

    // Update value display
    this.shadowRoot.getElementById('value').textContent = value.toFixed(config.decimals);
  }

  animateValueChange(fromValue, toValue) {
    const { config } = this;
    const steps = 20;
    const stepDuration = config.animation_duration / steps;
    const range = toValue - fromValue;

    if (this.animationInterval) {
      clearInterval(this.animationInterval);
    }

    let step = 0;
    this.animationInterval = setInterval(() => {
      step++;
      const progress = step / steps;
      const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      const currentValue = fromValue + range * eased;
      
      this.updateGauge(currentValue);

      if (step >= steps) {
        clearInterval(this.animationInterval);
        this.animationInterval = null;
      }
    }, stepDuration);
  }

  set hass(hass) {
    this._hass = hass;
    const entity = hass.states[this.config.entity];
    if (!entity) return;

    const state = parseFloat(entity.state);
    if (isNaN(state)) return;

    if (this.config.smooth_transitions && this.previousState !== null && this.previousState !== state) {
      this.animateValueChange(this.previousState, state);
    } else {
      this.updateGauge(state);
    }

    this.previousState = state;
  }

  getCardSize() {
    return 3;
  }

  static getStubConfig() {
    return {
      entity: 'sensor.temperature',
      name: 'Half Gauge',
      min: 0,
      max: 100,
      unit: '%'
    };
  }
}

// Register the card
customElements.define('half-gauge-card', HalfGaugeCard);

// Register card with Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'half-gauge-card',
  name: 'Half Gauge Card',
  description: 'A 180° gauge card for Home Assistant',
  preview: true
});

console.info(
  '%c HALF-GAUGE-CARD %c v1.0.0 ',
  'color: white; font-weight: bold; background: #ff9800;',
  'color: white; font-weight: bold; background: #333;'
);
