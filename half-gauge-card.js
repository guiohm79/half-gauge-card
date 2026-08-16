/**
 * Half Gauge Card - A simplified 180° gauge card for Home Assistant
 * Version: 2.0.0
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
      value_font_size: null,   // Custom font size for value (null = default based on position)
      value_offset_y: 0,       // Vertical offset for value display (pixels, positive = down)
      transparent_card: false,
      transparent_gauge: false,
      background_shadow: false, // Apply severity color to card background gradient
      background_shadow_intensity: 0.5, // Intensity of the background shadow (0-1)
      use_ha_card: false, // NEW: Option for ha-card Wrapper
      ...config
    };

    this.previousState = null;
    this.animationInterval = null;

    this.applyTheme();
    this.render();
  }

  /**
   * Home Assistant does not apply a card's `theme:` option on its behalf — `hui-card`, the
   * wrapper it puts around every card, leaves that to the card itself, the way the built-in
   * ones do in their `updated()`. The frontend helper doing the work lives in the editor
   * bundle and cannot be imported from a single-file card, so the useful part is reproduced
   * here: the theme variables are set on the host, and the shadow DOM inherits them.
   */
  applyTheme() {
    // Drop the previous theme first, otherwise switching themes leaves stale variables behind
    if (this._themeVars) {
      this._themeVars.forEach((prop) => this.style.removeProperty(prop));
      this._themeVars = null;
    }
    this._appliedTheme = this.config && this.config.theme;

    const themes = this._hass && this._hass.themes;
    const theme = themes && themes.themes && themes.themes[this._appliedTheme];
    if (!theme) return;

    // A theme can override part of its variables for the active light/dark mode
    const mode = themes.darkMode ? 'dark' : 'light';
    const vars = { ...theme, ...((theme.modes && theme.modes[mode]) || {}) };
    const applied = [];

    Object.entries(vars).forEach(([key, value]) => {
      if (key === 'modes' || typeof value !== 'string') return;
      this.style.setProperty(`--${key}`, value);
      applied.push(`--${key}`);
      // Home Assistant exposes an `--rgb-` companion for every hex color of a theme
      if (!key.startsWith('rgb') && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
        this.style.setProperty(`--rgb-${key}`, this.hexToRgb(value));
        applied.push(`--rgb-${key}`);
      }
    });

    this._themeVars = applied;
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
    
    // Card background - CSS supports colors and gradients natively. Under the ha-card
    // wrapper the card stays transparent: an opaque background would paint over the
    // wrapper and no theme could ever show through it.
    const cardBg = config.transparent_card || config.use_ha_card
      ? 'transparent'
      : (config.card_background || 'var(--ha-card-background, var(--card-background-color, #222))');

    // Parse gauge background - support both solid colors and gradients (SVG needs conversion)
    let gaugeBg = config.transparent_gauge ? 'transparent' : (config.gauge_background || 'var(--secondary-background-color, #333)');
    let gaugeBgSvg = '';
    let gaugeStrokeRef = '';
    
    if (gaugeBg.includes('gradient')) {
      const gradientDef = this.parseGradientToSvg(gaugeBg, 'gauge');
      gaugeBgSvg = gradientDef.svg;
      gaugeStrokeRef = `url(#${gradientDef.id})`;
    } else {
      gaugeStrokeRef = gaugeBg;
    }
    
    const styles = `
      :host {
        --text-color: ${config.text_color || 'var(--primary-text-color, #fff)'};
        --unit-color: ${config.unit_color || 'var(--secondary-text-color, #ddd)'};
        --title-color: ${config.title_color || 'var(--primary-text-color, #fff)'};
        --led-off-color: var(--disabled-text-color, #333);
      }

      /* The SVG takes its colors from CSS rather than from fill= / stroke= attributes:
         var() is not allowed in a presentation attribute, so a themed default set that
         way would simply be dropped by the browser. */
      .gauge-bg {
        fill: none;
        stroke: ${gaugeStrokeRef};
      }

      .led {
        fill: var(--led-off-color);
      }

      .card {
        background: ${cardBg};
        border-radius: var(--ha-card-border-radius, 16px);
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
        bottom: ${10 + (config.value_offset_y || 0)}px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        color: var(--text-color);
        pointer-events: none;
      }
      
      .value-inside .value {
        font-size: ${config.value_font_size || 32}px;
        font-weight: bold;
        line-height: 1;
        text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      }
      
      .value-inside .unit {
        font-size: ${(config.value_font_size || 32) * 0.375}px;
        color: var(--unit-color);
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      
      .value-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-top: ${5 + (config.value_offset_y || 0)}px;
        color: var(--text-color);
      }
      
      .value-display .value {
        font-size: ${config.value_font_size || 36}px;
        font-weight: bold;
        line-height: 1.1;
      }
      
      .value-display .unit {
        font-size: ${(config.value_font_size || 36) * 0.39}px;
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
      return `<circle id="led-${i}" class="led" cx="${x}" cy="${y}" r="${ledSize/2}" />`;
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

    const wrapStart = config.use_ha_card ? '<ha-card>' : '';
    const wrapEnd = config.use_ha_card ? '</ha-card>' : '';

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      ${wrapStart}
      <div class="card" id="card">
        <div class="gauge-container">
          <svg class="gauge-svg" viewBox="0 0 ${gaugeSize} ${halfSize}">
            <defs>
              ${gaugeBgSvg}
              <filter id="centerGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="${config.center_shadow_blur / 3}" result="blur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="${config.center_shadow_spread / 20}"/>
                </feComponentTransfer>
              </filter>
            </defs>
            <!-- Background arc -->
            <path class="gauge-bg"
                  d="M ${ledSize + 5},${halfSize} A ${radius},${radius} 0 0,1 ${gaugeSize - ledSize - 5},${halfSize}"
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
      ${wrapEnd}
    `;

    // Click handler for more info
    this.shadowRoot.getElementById('card').addEventListener('click', () => {
      const event = new Event('hass-more-info', { bubbles: true, composed: true });
      event.detail = { entityId: config.entity };
      this.dispatchEvent(event);
    });
  }

  applyColorToGradient(cssGradient, severityColor, intensity = 0.5) {
    // Parse the gradient and replace colors with the severity color at different opacities
    // intensity: 0 = very subtle, 1 = very strong
    
    // Use exponential scaling for better control at low intensities
    const baseOpacity = intensity * 0.05;  // 0 to 0.05
    const rangeOpacity = intensity * 0.25; // 0 to 0.25
    
    // For radial-gradient
    if (cssGradient.includes('radial-gradient')) {
      // Extract the shape and position part (e.g. "circle", "circle at center", etc.)
      const match = cssGradient.match(/radial-gradient\(([^,]+),\s*(.+)/);
      if (match) {
        const shape = match[1].trim();
        const stops = match[2].replace(')', '').split(',').map(s => s.trim());
        
        // Replace each stop color with severity color at varying opacity
        const newStops = stops.map((stop, index) => {
          const stopMatch = stop.match(/([^\s]+)\s+(.+)/);
          const offset = stopMatch ? stopMatch[2] : `${(index / (stops.length - 1)) * 100}%`;
          // Vary opacity: outer stops more transparent, inner more opaque
          const opacity = baseOpacity + (rangeOpacity * (1 - index / (stops.length - 1)));
          return `rgba(${this.hexToRgb(severityColor)}, ${opacity.toFixed(2)}) ${offset}`;
        });
        
        return `radial-gradient(${shape}, ${newStops.join(', ')})`;
      }
    }
    
    // For linear-gradient
    if (cssGradient.includes('linear-gradient')) {
      const match = cssGradient.match(/linear-gradient\(([^,]+),\s*(.+)/);
      if (match) {
        const direction = match[1].trim();
        const stops = match[2].replace(')', '').split(',').map(s => s.trim());
        
        // Replace each stop color with severity color at varying opacity
        const newStops = stops.map((stop, index) => {
          const stopMatch = stop.match(/([^\s]+)\s+(.+)/);
          const offset = stopMatch ? stopMatch[2] : `${(index / (stops.length - 1)) * 100}%`;
          // Vary opacity based on position
          const opacity = baseOpacity + (rangeOpacity * (index / (stops.length - 1)));
          return `rgba(${this.hexToRgb(severityColor)}, ${opacity.toFixed(2)}) ${offset}`;
        });
        
        return `linear-gradient(${direction}, ${newStops.join(', ')})`;
      }
    }
    
    // Fallback: return original
    return cssGradient;
  }

  hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Handle 3-digit hex
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    return `${r}, ${g}, ${b}`;
  }

  parseGradientToSvg(cssGradient, prefix = 'gradient') {
    const id = prefix + 'Grad' + Math.random().toString(36).substr(2, 9);
    
    // Parse linear-gradient
    const linearMatch = cssGradient.match(/linear-gradient\(([^)]+)\)/);
    if (linearMatch) {
      const parts = linearMatch[1].split(',').map(p => p.trim());
      const direction = parts[0];
      const stops = parts.slice(1);
      
      // Map CSS direction to SVG coordinates
      let x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%';
      if (direction.includes('to right')) { x1 = '0%'; y1 = '0%'; x2 = '100%'; y2 = '0%'; }
      else if (direction.includes('to left')) { x1 = '100%'; y1 = '0%'; x2 = '0%'; y2 = '0%'; }
      else if (direction.includes('to bottom')) { x1 = '0%'; y1 = '0%'; x2 = '0%'; y2 = '100%'; }
      else if (direction.includes('to top')) { x1 = '0%'; y1 = '100%'; x2 = '0%'; y2 = '0%'; }
      else if (direction.includes('deg')) {
        const angle = parseInt(direction);
        const rad = (angle - 90) * Math.PI / 180;
        x1 = '50%'; y1 = '50%';
        x2 = `${50 + 50 * Math.cos(rad)}%`;
        y2 = `${50 + 50 * Math.sin(rad)}%`;
      }
      
      const stopElements = stops.map((stop, index) => {
        const stopMatch = stop.match(/([^\s]+)\s+(.+)/);
        if (stopMatch) {
          const color = stopMatch[1];
          const offset = stopMatch[2];
          return `<stop offset="${offset}" stop-color="${color}" />`;
        }
        // If no offset specified, distribute evenly
        const offset = (index / (stops.length - 1)) * 100;
        return `<stop offset="${offset}%" stop-color="${stop}" />`;
      }).join('\n');
      
      return {
        id,
        svg: `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopElements}</linearGradient>`
      };
    }
    
    // Parse radial-gradient
    const radialMatch = cssGradient.match(/radial-gradient\(([^)]+)\)/);
    if (radialMatch) {
      const parts = radialMatch[1].split(',').map(p => p.trim());
      const shape = parts[0].includes('circle') ? 'circle' : 'ellipse';
      const stops = parts.slice(1);
      
      const stopElements = stops.map((stop, index) => {
        const stopMatch = stop.match(/([^\s]+)\s+(.+)/);
        if (stopMatch) {
          const color = stopMatch[1];
          const offset = stopMatch[2];
          return `<stop offset="${offset}" stop-color="${color}" />`;
        }
        const offset = (index / (stops.length - 1)) * 100;
        return `<stop offset="${offset}%" stop-color="${stop}" />`;
      }).join('\n');
      
      return {
        id,
        svg: `<radialGradient id="${id}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">${stopElements}</radialGradient>`
      };
    }
    
    // Fallback - return as-is
    return { id, svg: '' };
  }

  getLedColor(value, min, max) {
    const range = max - min;
    const severity = this.config.severity || [
      { color: '#4caf50', value: min },
      { color: '#ffeb3b', value: min + range * 0.33 },
      { color: '#f44336', value: min + range * 0.66 }
    ];

    // A threshold is a LOWER bound: its color applies from its value up to the next
    // threshold, in the entity's own units — same convention as the native HA gauge
    // (`segments: [{ from: ... }]`). Sort a copy descending so the highest reached
    // threshold wins whatever order the entries were typed in.
    const sorted = [...severity].sort((a, b) => b.value - a.value);

    for (const level of sorted) {
      if (value >= level.value) return level.color;
    }

    // Below the lowest threshold: keep its color rather than leaving a grey hole.
    return sorted[sorted.length - 1]?.color || '#555';
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

    // Update background shadow (severity color applied to card background gradient)
    if (config.background_shadow && config.card_background && config.card_background.includes('gradient')) {
      const card = this.shadowRoot.querySelector('.card');
      const intensity = config.background_shadow_intensity !== undefined ? config.background_shadow_intensity : 0.5;
      const coloredGradient = this.applyColorToGradient(config.card_background, color, intensity);
      card.style.background = coloredGradient;
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
        // Inline style, not a `fill` attribute: the attribute loses to the `.led` CSS rule
        led.style.fill = color;
        // Restore the opacity, which `hide_inactive_leds` may have zeroed when the gauge
        // was lower — without this the hidden LEDs never come back as the value rises
        led.setAttribute('opacity', '1');
        led.setAttribute('filter', `drop-shadow(0 0 4px ${color})`);
      } else {
        if (config.hide_inactive_leds) {
          led.setAttribute('opacity', '0');
        } else {
          led.style.fill = '';  // back to the themed --led-off-color
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
    // Themes travel on the hass object: re-apply when it changes, or when the card was
    // pointed at another theme. Cheap enough, and it catches a theme edited live.
    const themesChanged = !this._hass || this._hass.themes !== hass.themes;
    this._hass = hass;
    if (themesChanged || this._appliedTheme !== this.config.theme) {
      this.applyTheme();
    }

    const entity = hass.states[this.config.entity];
    if (!entity) return;

    const rawValue = this.config.attribute
      ? entity.attributes[this.config.attribute]
      : entity.state;
    const state = parseFloat(rawValue);
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

  static getConfigElement() {
    return document.createElement('half-gauge-card-editor');
  }
}

// ==================== EDITOR ====================

class HalfGaugeCardEditor extends HTMLElement {
  constructor() {
    super();
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...config };
    if (this._hass) {
      this._updateForm();
    }
  }

  set hass(hass) {
    const firstHass = !this._hass;
    this._hass = hass;
    if (firstHass) {
      this._buildEditor();
    } else {
      const form = this.querySelector('ha-form');
      if (form) form.hass = hass;
    }
  }

  get hass() {
    return this._hass;
  }

  _getSchema() {
    return [
      { name: 'entity', required: true, selector: { entity: {} } },
      ...(this._config?.entity ? [
        { name: 'attribute', selector: { attribute: { entity_id: this._config.entity } } }
      ] : []),
      { name: 'name', selector: { text: {} } },
      { name: 'unit', selector: { text: {} } },
      {
        type: 'expandable', title: 'Range & Decimals', icon: 'mdi:tune-vertical',
        schema: [
          { name: 'min', selector: { number: { mode: 'box' } } },
          { name: 'max', selector: { number: { mode: 'box' } } },
          { name: 'decimals', selector: { number: { min: 0, max: 10, mode: 'box' } } },
        ]
      },
      {
        type: 'expandable', title: 'Appearance', icon: 'mdi:gauge',
        schema: [
          { name: 'gauge_size', selector: { number: { min: 100, max: 400, step: 10, mode: 'slider' } } },
          { name: 'leds_count', selector: { number: { min: 10, max: 200, step: 5, mode: 'slider' } } },
          { name: 'led_size', selector: { number: { min: 4, max: 20, mode: 'slider' } } },
          { name: 'value_position', selector: { select: { options: [
            { value: 'below', label: 'Below' },
            { value: 'inside', label: 'Inside' }
          ] } } },
          { name: 'value_font_size', selector: { number: { min: 8, max: 100, mode: 'box' } } },
          { name: 'value_offset_y', selector: { number: { min: -100, max: 100, mode: 'slider' } } },
        ]
      },
      {
        type: 'expandable', title: 'Shadows', icon: 'mdi:blur',
        schema: [
          { name: 'enable_shadow', selector: { boolean: {} } },
          { name: 'background_shadow', selector: { boolean: {} } },
          { name: 'background_shadow_intensity', selector: { number: { min: 0, max: 1, step: 0.05, mode: 'slider' } } },
          { name: 'center_shadow', selector: { boolean: {} } },
          { name: 'center_shadow_blur', selector: { number: { min: 0, max: 200, mode: 'slider' } } },
          { name: 'center_shadow_spread', selector: { number: { min: 0, max: 50, mode: 'slider' } } },
          { name: 'center_shadow_size', selector: { number: { min: 0, max: 200, mode: 'slider' } } },
        ]
      },
      {
        type: 'expandable', title: 'Display', icon: 'mdi:eye',
        schema: [
          { name: 'transparent_card', selector: { boolean: {} } },
          { name: 'transparent_gauge', selector: { boolean: {} } },
          { name: 'hide_inactive_leds', selector: { boolean: {} } },
          { name: 'use_ha_card', selector: { boolean: {} } },
          { name: 'theme', selector: { theme: {} } },
        ]
      },
      {
        type: 'expandable', title: 'Animation', icon: 'mdi:motion-play',
        schema: [
          { name: 'smooth_transitions', selector: { boolean: {} } },
          { name: 'animation_duration', selector: { number: { min: 100, max: 2000, step: 100, mode: 'slider' } } },
        ]
      },
    ];
  }

  _computeLabel(schema) {
    const labels = {
      entity: 'Entity',
      attribute: 'Attribute (optional)',
      name: 'Name',
      unit: 'Unit of measurement',
      min: 'Minimum value',
      max: 'Maximum value',
      decimals: 'Decimals',
      gauge_size: 'Gauge size (px)',
      leds_count: 'Number of LEDs',
      led_size: 'LED size (px)',
      value_position: 'Value position',
      value_font_size: 'Font size (px) — empty = auto',
      value_offset_y: 'Vertical offset (px)',
      text_color: 'Value color',
      unit_color: 'Unit color',
      title_color: 'Title color',
      card_background: 'Card background',
      gauge_background: 'Gauge background',
      enable_shadow: 'Enable LED shadow',
      background_shadow: 'Background severity shadow',
      background_shadow_intensity: 'Shadow intensity',
      center_shadow: 'Center shadow',
      center_shadow_blur: 'Blur radius',
      center_shadow_spread: 'Spread',
      center_shadow_size: 'Size (%)',
      transparent_card: 'Transparent card',
      transparent_gauge: 'Transparent gauge',
      hide_inactive_leds: 'Hide inactive LEDs',
      use_ha_card: 'Use ha-card wrapper',
      theme: 'Theme (empty = dashboard theme)',
      smooth_transitions: 'Smooth transitions',
      animation_duration: 'Animation duration (ms)',
    };
    return labels[schema.name] || schema.name;
  }

  _buildEditor() {
    this.innerHTML = '';

    const form = document.createElement('ha-form');
    form.hass = this._hass;
    form.data = this._config;
    form.schema = this._getSchema();
    form.computeLabel = (s) => this._computeLabel(s);

    const COLOR_KEYS = ['text_color', 'unit_color', 'title_color', 'card_background', 'gauge_background'];

    form.addEventListener('value-changed', (e) => {
      const formData = e.detail.value;
      const entityChanged = formData.entity !== this._config.entity;
      // Preserve fields managed outside ha-form (colors + severity)
      const preserved = {};
      COLOR_KEYS.forEach(k => { if (this._config[k]) preserved[k] = this._config[k]; });
      if (this._config.severity?.length) preserved.severity = this._config.severity;
      this._config = { ...formData, ...preserved };
      if (entityChanged) form.schema = this._getSchema();
      this._dispatchConfigChanged();
      this._renderSeveritySection();
    });

    this.appendChild(form);

    // Colors panel — panel element is permanent, only content rebuilds
    const colorPanel = document.createElement('ha-expansion-panel');
    colorPanel.header = 'Colors';
    colorPanel.outlined = true;
    this._colorsContent = document.createElement('div');
    this._colorsContent.style.cssText = 'padding:8px 16px 12px;';
    colorPanel.appendChild(this._colorsContent);
    this.appendChild(colorPanel);

    // Severity panel — same pattern
    const severityPanel = document.createElement('ha-expansion-panel');
    severityPanel.header = 'Color Thresholds (Severity)';
    severityPanel.outlined = true;
    this._severityContent = document.createElement('div');
    this._severityContent.style.cssText = 'padding:8px 16px 12px;';
    severityPanel.appendChild(this._severityContent);
    this.appendChild(severityPanel);

    this._renderColorsSection(true);
    this._renderSeveritySection(true);
  }

  _updateForm() {
    const form = this.querySelector('ha-form');
    if (!form) { this._buildEditor(); return; }
    form.data = this._config;
    form.schema = this._getSchema();
    this._renderColorsSection();
    this._renderSeveritySection();
  }

  _isHexColor(val) {
    return /^#[0-9a-fA-F]{3,8}$/.test((val || '').trim());
  }

  /**
   * Deepest focused element, walking down the shadow roots — the editor is mounted inside
   * the Home Assistant dialog, so `document.activeElement` only reports the outer host.
   */
  _deepActiveElement() {
    let active = document.activeElement;
    while (active && active.shadowRoot && active.shadowRoot.activeElement) {
      active = active.shadowRoot.activeElement;
    }
    return active;
  }

  /**
   * True while the focus sits inside `section`. The browser colour picker is a modal
   * anchored to its `<input type="color">` and keeps that input focused: rebuilding the
   * section underneath destroys the anchor, which closes the picker the moment the user
   * clicks a colour. Same story for a text field being typed into.
   */
  _isEditing(section) {
    const active = this._deepActiveElement();
    return !!active && section.contains(active);
  }

  _renderColorsSection(force = false) {
    if (!this._colorsContent) return;
    const c = this._colorsContent;
    if (!force && this._isEditing(c)) return;
    c.innerHTML = '';

    const IS = 'background:var(--secondary-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color,rgba(255,255,255,0.15));border-radius:4px;padding:5px 8px;font-size:13px;box-sizing:border-box;';

    // Simple color fields
    [
      { key: 'text_color',  label: 'Value color',  ph: '#ffffff' },
      { key: 'unit_color',  label: 'Unit color',   ph: '#dddddd' },
      { key: 'title_color', label: 'Title color',  ph: '#ffffff' },
    ].forEach(({ key, label, ph }) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:0 0 120px;font-size:13px;color:var(--primary-text-color);';
      lbl.textContent = label;
      const sw = document.createElement('input');
      sw.type = 'color';
      sw.style.cssText = 'width:36px;height:36px;border:none;border-radius:6px;padding:2px;cursor:pointer;background:none;flex-shrink:0;';
      const cv = this._config[key] || '';
      sw.value = this._isHexColor(cv) ? cv : '#000000';
      const txt = document.createElement('input');
      txt.style.cssText = IS + 'flex:1;'; txt.value = cv; txt.placeholder = ph;
      // `change`, not `input`: the picker streams a colour on every cursor move, and each
      // one would rebuild the card preview for nothing. `change` fires once, on validation.
      sw.addEventListener('change', (e) => { txt.value = e.target.value; this._setColorConfig(key, e.target.value); });
      txt.addEventListener('change', (e) => { if (this._isHexColor(e.target.value)) sw.value = e.target.value; this._setColorConfig(key, e.target.value); });
      row.appendChild(lbl); row.appendChild(sw); row.appendChild(txt);
      c.appendChild(row);
    });

    // Background gradient fields
    [
      { key: 'card_background',  label: 'Card background'  },
      { key: 'gauge_background', label: 'Gauge background' },
    ].forEach(({ key, label }) => {
      const block = document.createElement('div');
      block.style.cssText = 'margin-bottom:16px;';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:13px;color:var(--primary-text-color);margin-bottom:8px;font-weight:500;';
      lbl.textContent = label;
      block.appendChild(lbl);
      block.appendChild(this._createBgEditor(key, IS));
      c.appendChild(block);
    });
  }

  _setColorConfig(key, value) {
    if (!value) {
      const { [key]: _removed, ...rest } = this._config;
      this._config = rest;
    } else {
      this._config = { ...this._config, [key]: value };
    }
    this._dispatchConfigChanged();
  }

  _detectBgMode(val) {
    if (!val) return 'solid';
    if (/^linear-gradient\(/i.test(val)) return 'linear';
    if (/^radial-gradient\(/i.test(val)) return 'radial';
    if (/^#[0-9a-f]{3,8}$/i.test((val || '').trim())) return 'solid';
    return 'custom';
  }

  _parseGradientStops(str) {
    const stops = [];
    const re = /(#[0-9a-f]{3,8}|rgba?\([^)]+\))\s*(\d+%)?/gi;
    let m;
    while ((m = re.exec(str)) !== null)
      stops.push({ color: m[1], position: m[2] ? parseInt(m[2]) : null });
    return stops.length >= 2 ? stops : [{ color: '#333333', position: 0 }, { color: '#111111', position: 100 }];
  }

  _parseLinearGradient(val) {
    const m = (val || '').match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?deg)\s*,\s*([\s\S]+)\)$/i);
    return m ? { angle: parseInt(m[1]), stops: this._parseGradientStops(m[2]) } : null;
  }

  _parseRadialGradient(val) {
    const m = (val || '').match(/radial-gradient\(\s*(circle|ellipse)\s*,\s*([\s\S]+)\)$/i);
    return m ? { shape: m[1], stops: this._parseGradientStops(m[2]) } : null;
  }

  _buildLinearGradient(angle, stops) {
    return `linear-gradient(${angle}deg, ${stops.map(s => s.position != null ? `${s.color} ${s.position}%` : s.color).join(', ')})`;
  }

  _buildRadialGradient(shape, stops) {
    return `radial-gradient(${shape}, ${stops.map(s => s.position != null ? `${s.color} ${s.position}%` : s.color).join(', ')})`;
  }

  _createBgEditor(key, IS) {
    const val = this._config[key] || '';
    let mode = this._detectBgMode(val);
    const parsedL = this._parseLinearGradient(val);
    const parsedR = this._parseRadialGradient(val);
    let angle = parsedL?.angle ?? 135;
    let shape = parsedR?.shape ?? 'circle';
    let stops = (parsedL || parsedR)?.stops ?? [{ color: '#333333', position: 0 }, { color: '#111111', position: 100 }];

    const SW = 'width:30px;height:30px;border:none;border-radius:5px;padding:2px;cursor:pointer;background:none;flex-shrink:0;';
    const wrapper = document.createElement('div');

    // Preview bar
    const preview = document.createElement('div');
    preview.style.cssText = 'height:22px;border-radius:6px;border:1px solid var(--divider-color,rgba(255,255,255,0.15));margin-bottom:8px;';
    preview.style.background = val || 'transparent';
    wrapper.appendChild(preview);

    const save = (cssVal) => {
      preview.style.background = cssVal || 'transparent';
      this._setColorConfig(key, cssVal);
    };

    // Mode tab bar
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap;';
    const setActiveTab = (m) => tabBar.querySelectorAll('button').forEach(b => {
      const on = b.dataset.mode === m;
      b.style.background = on ? 'var(--primary-color,#03a9f4)' : 'transparent';
      b.style.color = on ? '#fff' : 'var(--secondary-text-color)';
    });
    wrapper.appendChild(tabBar);

    const content = document.createElement('div');
    wrapper.appendChild(content);

    // Shared stops editor
    const makeStopsEditor = (onUpdate) => {
      const div = document.createElement('div');
      const render = () => {
        div.innerHTML = '';
        stops.forEach((stop, i) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
          const sw = document.createElement('input');
          sw.type = 'color'; sw.style.cssText = SW;
          sw.value = this._isHexColor(stop.color) ? stop.color : '#333333';
          const ct = document.createElement('input');
          ct.style.cssText = IS + 'width:76px;'; ct.value = stop.color; ct.placeholder = '#333';
          const pos = document.createElement('input');
          pos.type = 'number'; pos.min = 0; pos.max = 100;
          pos.style.cssText = IS + 'width:54px;';
          pos.value = stop.position ?? ''; pos.placeholder = '%';
          sw.addEventListener('change', (e) => { ct.value = e.target.value; stops[i].color = e.target.value; onUpdate(); });
          ct.addEventListener('change', (e) => { if (this._isHexColor(e.target.value)) sw.value = e.target.value; stops[i].color = e.target.value; onUpdate(); });
          pos.addEventListener('change', (e) => { stops[i].position = e.target.value === '' ? null : parseInt(e.target.value); onUpdate(); });
          row.appendChild(sw); row.appendChild(ct); row.appendChild(pos);
          if (stops.length > 2) {
            const del = document.createElement('button');
            del.textContent = '×';
            del.style.cssText = 'background:none;border:none;color:var(--secondary-text-color);cursor:pointer;font-size:16px;padding:0 4px;';
            del.addEventListener('click', () => { stops.splice(i, 1); onUpdate(); render(); });
            row.appendChild(del);
          }
          div.appendChild(row);
        });
        if (stops.length < 5) {
          const add = document.createElement('button');
          add.textContent = '+ Add stop';
          add.style.cssText = IS + 'cursor:pointer;margin-top:2px;';
          add.addEventListener('click', () => { stops.push({ color: '#666666', position: null }); onUpdate(); render(); });
          div.appendChild(add);
        }
      };
      render();
      return div;
    };

    const renderContent = (m) => {
      content.innerHTML = '';
      if (m === 'solid') {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;';
        const sw = document.createElement('input');
        sw.type = 'color'; sw.style.cssText = SW;
        const cv = this._config[key] || '';
        sw.value = this._isHexColor(cv) ? cv : '#222222';
        const txt = document.createElement('input');
        txt.style.cssText = IS + 'flex:1;'; txt.value = cv; txt.placeholder = '#222222';
        sw.addEventListener('change', (e) => { txt.value = e.target.value; save(e.target.value); });
        txt.addEventListener('change', (e) => { if (this._isHexColor(e.target.value)) sw.value = e.target.value; save(e.target.value); });
        row.appendChild(sw); row.appendChild(txt); content.appendChild(row);

      } else if (m === 'linear') {
        const ar = document.createElement('div');
        ar.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
        const al = document.createElement('span');
        al.style.cssText = 'font-size:12px;color:var(--secondary-text-color);width:44px;';
        al.textContent = 'Angle';
        const asl = document.createElement('input');
        asl.type = 'range'; asl.min = 0; asl.max = 360; asl.value = angle; asl.style.cssText = 'flex:1;';
        const anum = document.createElement('input');
        anum.type = 'number'; anum.min = 0; anum.max = 360; anum.value = angle;
        anum.style.cssText = IS + 'width:52px;';
        const adeg = document.createElement('span');
        adeg.textContent = '°'; adeg.style.cssText = 'color:var(--secondary-text-color);font-size:13px;';
        const onA = (v) => { angle = parseInt(v) || 0; asl.value = angle; anum.value = angle; save(this._buildLinearGradient(angle, stops)); };
        asl.addEventListener('input', (e) => onA(e.target.value));
        anum.addEventListener('change', (e) => onA(e.target.value));
        ar.appendChild(al); ar.appendChild(asl); ar.appendChild(anum); ar.appendChild(adeg);
        content.appendChild(ar);
        const sl = document.createElement('div');
        sl.style.cssText = 'font-size:12px;color:var(--secondary-text-color);margin-bottom:4px;';
        sl.textContent = 'Color stops';
        content.appendChild(sl);
        content.appendChild(makeStopsEditor(() => save(this._buildLinearGradient(angle, stops))));

      } else if (m === 'radial') {
        const sr = document.createElement('div');
        sr.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;';
        const shl = document.createElement('span');
        shl.style.cssText = 'font-size:12px;color:var(--secondary-text-color);width:44px;';
        shl.textContent = 'Shape';
        ['circle', 'ellipse'].forEach(s => {
          const btn = document.createElement('button');
          btn.textContent = s;
          btn.style.cssText = `padding:3px 10px;border-radius:12px;cursor:pointer;font-size:12px;border:1px solid var(--divider-color,rgba(255,255,255,0.2));background:${shape === s ? 'var(--primary-color,#03a9f4)' : 'transparent'};color:${shape === s ? '#fff' : 'var(--secondary-text-color)'};`;
          btn.addEventListener('click', () => {
            shape = s;
            sr.querySelectorAll('button').forEach(b => { const on = b.textContent === shape; b.style.background = on ? 'var(--primary-color,#03a9f4)' : 'transparent'; b.style.color = on ? '#fff' : 'var(--secondary-text-color)'; });
            save(this._buildRadialGradient(shape, stops));
          });
          sr.appendChild(btn);
        });
        sr.insertBefore(shl, sr.firstChild);
        content.appendChild(sr);
        const sl = document.createElement('div');
        sl.style.cssText = 'font-size:12px;color:var(--secondary-text-color);margin-bottom:4px;';
        sl.textContent = 'Color stops';
        content.appendChild(sl);
        content.appendChild(makeStopsEditor(() => save(this._buildRadialGradient(shape, stops))));

      } else {
        const txt = document.createElement('input');
        txt.style.cssText = IS + 'width:100%;';
        txt.value = this._config[key] || '';
        txt.placeholder = 'linear-gradient(45deg, #333, #111)';
        txt.addEventListener('input', (e) => { preview.style.background = e.target.value; });
        txt.addEventListener('change', (e) => save(e.target.value));
        content.appendChild(txt);
      }
    };

    [['Solid', 'solid'], ['Linear', 'linear'], ['Radial', 'radial'], ['Custom', 'custom']].forEach(([label, value]) => {
      const btn = document.createElement('button');
      btn.textContent = label; btn.dataset.mode = value;
      btn.style.cssText = `padding:3px 10px;border-radius:12px;cursor:pointer;font-size:12px;border:1px solid var(--divider-color,rgba(255,255,255,0.2));background:${value === mode ? 'var(--primary-color,#03a9f4)' : 'transparent'};color:${value === mode ? '#fff' : 'var(--secondary-text-color)'};`;
      btn.addEventListener('click', () => {
        mode = value;
        if (value === 'linear' && !this._parseLinearGradient(this._config[key] || '')) save(this._buildLinearGradient(angle, stops));
        if (value === 'radial' && !this._parseRadialGradient(this._config[key] || '')) save(this._buildRadialGradient(shape, stops));
        setActiveTab(value);
        renderContent(value);
      });
      tabBar.appendChild(btn);
    });

    renderContent(mode);
    return wrapper;
  }

  _renderSeveritySection(force = false) {
    if (!this._severityContent) return;
    const c = this._severityContent;
    if (!force && this._isEditing(c)) return;
    c.innerHTML = '';

    const SEV_IS = 'background:var(--secondary-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color,rgba(255,255,255,0.15));border-radius:4px;padding:6px 8px;font-size:14px;box-sizing:border-box;';
    const SEV_SW = 'width:34px;height:34px;border:none;border-radius:6px;padding:2px;cursor:pointer;background:none;flex-shrink:0;';

    const hint = document.createElement('div');
    hint.style.cssText = 'color:var(--secondary-text-color);font-size:13px;margin-bottom:12px;';
    hint.textContent = 'Each color applies from its value upwards, until the next threshold — same as the built-in gauge segments.';
    c.appendChild(hint);

    const severity = this._config.severity || [];
    severity.forEach((item, index) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';

      const valInput = document.createElement('input');
      valInput.style.cssText = SEV_IS + 'width:80px;';
      valInput.type = 'number';
      valInput.value = item.value;
      valInput.placeholder = 'Value';
      valInput.addEventListener('change', (e) => {
        this._updateSeverity(index, 'value', parseFloat(e.target.value) || 0);
      });

      const colorSwatch = document.createElement('input');
      colorSwatch.type = 'color';
      colorSwatch.style.cssText = SEV_SW;
      colorSwatch.value = this._isHexColor(item.color) ? item.color : '#4caf50';

      const colorInput = document.createElement('input');
      colorInput.style.cssText = SEV_IS + 'flex:1;';
      colorInput.value = item.color;
      colorInput.placeholder = '#4caf50';

      colorSwatch.addEventListener('change', (e) => {
        colorInput.value = e.target.value;
        this._updateSeverity(index, 'color', e.target.value);
      });
      colorInput.addEventListener('change', (e) => {
        const v = e.target.value;
        if (this._isHexColor(v)) colorSwatch.value = v;
        this._updateSeverity(index, 'color', v);
      });

      const removeBtn = document.createElement('ha-icon-button');
      removeBtn.title = 'Remove';
      removeBtn.innerHTML = '<ha-icon icon="mdi:delete"></ha-icon>';
      removeBtn.addEventListener('click', () => this._removeSeverity(index));

      row.appendChild(valInput);
      row.appendChild(colorSwatch);
      row.appendChild(colorInput);
      row.appendChild(removeBtn);
      c.appendChild(row);
    });

    if (severity.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'color:var(--secondary-text-color);font-size:13px;margin-bottom:12px;';
      empty.textContent = 'No thresholds defined. Using defaults.';
      c.appendChild(empty);
    }

    const addBtn = document.createElement('ha-button');
    addBtn.textContent = 'Add Threshold';
    addBtn.addEventListener('click', () => this._addSeverity());
    c.appendChild(addBtn);
  }

  _dispatchConfigChanged() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }


  _updateSeverity(index, field, value) {
    const severity = [...(this._config.severity || [])];
    severity[index] = { ...severity[index], [field]: value };
    this._config = { ...this._config, severity };
    this._dispatchConfigChanged();
  }

  _addSeverity() {
    const severity = [...(this._config.severity || [])];
    const max = this._config.max !== undefined ? this._config.max : 100;
    const min = this._config.min !== undefined ? this._config.min : 0;
    severity.push({
      color: '#4caf50',
      // The first threshold opens at the gauge minimum so the low end is covered explicitly.
      value: severity.length > 0
        ? Math.min(max, severity[severity.length - 1].value + Math.round((max - min) / 3))
        : min,
    });
    this._config = { ...this._config, severity };
    this._dispatchConfigChanged();
    // Forced: the focus sits on the Add button, inside the section being rebuilt.
    this._renderSeveritySection(true);
  }

  _removeSeverity(index) {
    const severity = [...(this._config.severity || [])];
    severity.splice(index, 1);
    if (severity.length > 0) {
      this._config = { ...this._config, severity };
    } else {
      const { severity: _s, ...rest } = this._config;
      this._config = rest;
    }
    this._dispatchConfigChanged();
    // Forced: the focus sits on the delete button, inside the section being rebuilt.
    this._renderSeveritySection(true);
  }
}

customElements.define('half-gauge-card-editor', HalfGaugeCardEditor);

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
  '%c HALF-GAUGE-CARD %c v2.0.0 ',
  'color: white; font-weight: bold; background: #ff9800;',
  'color: white; font-weight: bold; background: #333;'
);
