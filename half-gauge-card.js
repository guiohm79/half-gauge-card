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
      value_font_size: null,   // Custom font size for value (null = default based on position)
      value_offset_y: 0,       // Vertical offset for value display (pixels, positive = down)
      transparent_card: false,
      transparent_gauge: false,
      background_shadow: false, // Apply severity color to card background gradient
      background_shadow_intensity: 0.5, // Intensity of the background shadow (0-1)
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
    
    // Card background - CSS supports colors and gradients natively
    const cardBg = config.transparent_card ? 'transparent' : (config.card_background || '#222');
    
    // Parse gauge background - support both solid colors and gradients (SVG needs conversion)
    let gaugeBg = config.transparent_gauge ? 'transparent' : (config.gauge_background || '#333');
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
        --text-color: ${config.text_color || '#fff'};
        --unit-color: ${config.unit_color || '#ddd'};
        --title-color: ${config.title_color || '#fff'};
      }
      
      .card {
        background: ${cardBg};
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
              ${gaugeBgSvg}
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
                  stroke="${gaugeStrokeRef}" 
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
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Only update entity picker if it exists
    const entityPicker = this.querySelector('ha-entity-picker');
    if (entityPicker && !entityPicker.hass) {
      entityPicker.hass = hass;
    }
  }

  get hass() {
    return this._hass;
  }

  _render() {
    if (!this._hass) return;

    const config = this._config || {};

    // Create container
    this.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'form';
    container.style.cssText = 'display:flex;flex-direction:column;gap:16px;padding:16px;';

    // Helper to create section
    const createSection = (title) => {
      const section = document.createElement('div');
      section.className = 'section';
      section.style.cssText = 'border:1px solid var(--divider-color,#e0e0e0);border-radius:8px;padding:16px;';
      
      const sectionTitle = document.createElement('div');
      sectionTitle.className = 'section-title';
      sectionTitle.style.cssText = 'font-size:14px;font-weight:500;margin-bottom:12px;color:var(--primary-text-color);text-transform:uppercase;letter-spacing:0.5px;';
      sectionTitle.textContent = title;
      
      section.appendChild(sectionTitle);
      return section;
    };

    // Helper to create row
    const createRow = (labelText) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;min-height:40px;';
      
      const label = document.createElement('label');
      label.style.cssText = 'flex:0 0 140px;font-size:14px;color:var(--primary-text-color);';
      label.textContent = labelText;
      
      row.appendChild(label);
      return row;
    };

    // ===== SECTION: Basic =====
    const basicSection = createSection('Basic Settings');

    // Entity
    const entityRow = createRow('Entity *');
    const entityPicker = document.createElement('ha-entity-picker');
    entityPicker.style.cssText = 'flex:1;';
    entityPicker.hass = this._hass;
    entityPicker.value = config.entity || '';
    entityPicker.allowCustomEntity = true;
    entityPicker.addEventListener('value-changed', (e) => {
      this._updateConfig('entity', e.detail.value);
    });
    entityRow.appendChild(entityPicker);
    basicSection.appendChild(entityRow);

    // Name
    const nameRow = createRow('Name');
    const nameInput = document.createElement('ha-textfield');
    nameInput.style.cssText = 'flex:1;';
    nameInput.value = config.name || '';
    nameInput.placeholder = 'Half Gauge';
    nameInput.addEventListener('change', (e) => {
      this._updateConfig('name', e.target.value);
    });
    nameRow.appendChild(nameInput);
    basicSection.appendChild(nameRow);

    // Unit
    const unitRow = createRow('Unit');
    const unitInput = document.createElement('ha-textfield');
    unitInput.style.cssText = 'flex:1;';
    unitInput.value = config.unit || '';
    unitInput.placeholder = '%';
    unitInput.addEventListener('change', (e) => {
      this._updateConfig('unit', e.target.value);
    });
    unitRow.appendChild(unitInput);
    basicSection.appendChild(unitRow);

    // Min
    const minRow = createRow('Min Value');
    const minInput = document.createElement('ha-textfield');
    minInput.style.cssText = 'flex:1;';
    minInput.type = 'number';
    minInput.value = config.min !== undefined ? config.min : 0;
    minInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) this._updateConfig('min', val);
    });
    minRow.appendChild(minInput);
    basicSection.appendChild(minRow);

    // Max
    const maxRow = createRow('Max Value');
    const maxInput = document.createElement('ha-textfield');
    maxInput.style.cssText = 'flex:1;';
    maxInput.type = 'number';
    maxInput.value = config.max !== undefined ? config.max : 100;
    maxInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) this._updateConfig('max', val);
    });
    maxRow.appendChild(maxInput);
    basicSection.appendChild(maxRow);

    // Decimals
    const decimalsRow = createRow('Decimals');
    const decimalsInput = document.createElement('ha-textfield');
    decimalsInput.style.cssText = 'flex:1;';
    decimalsInput.type = 'number';
    decimalsInput.value = config.decimals !== undefined ? config.decimals : 0;
    decimalsInput.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) this._updateConfig('decimals', val);
    });
    decimalsRow.appendChild(decimalsInput);
    basicSection.appendChild(decimalsRow);

    container.appendChild(basicSection);

    // ===== SECTION: Visual =====
    const visualSection = createSection('Visual Settings');

    // Gauge Size
    const gaugeSizeRow = createRow('Gauge Size (px)');
    const gaugeSizeSlider = document.createElement('ha-slider');
    gaugeSizeSlider.style.cssText = 'flex:1;';
    gaugeSizeSlider.min = 100;
    gaugeSizeSlider.max = 400;
    gaugeSizeSlider.step = 10;
    gaugeSizeSlider.value = config.gauge_size || 200;
    gaugeSizeSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue1.textContent = val;
      this._updateConfig('gauge_size', val);
    });
    const sliderValue1 = document.createElement('span');
    sliderValue1.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue1.textContent = config.gauge_size || 200;
    gaugeSizeRow.appendChild(gaugeSizeSlider);
    gaugeSizeRow.appendChild(sliderValue1);
    visualSection.appendChild(gaugeSizeRow);

    // LEDs Count
    const ledsCountRow = createRow('LEDs Count');
    const ledsCountSlider = document.createElement('ha-slider');
    ledsCountSlider.style.cssText = 'flex:1;';
    ledsCountSlider.min = 10;
    ledsCountSlider.max = 200;
    ledsCountSlider.step = 5;
    ledsCountSlider.value = config.leds_count || 50;
    ledsCountSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue2.textContent = val;
      this._updateConfig('leds_count', val);
    });
    const sliderValue2 = document.createElement('span');
    sliderValue2.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue2.textContent = config.leds_count || 50;
    ledsCountRow.appendChild(ledsCountSlider);
    ledsCountRow.appendChild(sliderValue2);
    visualSection.appendChild(ledsCountRow);

    // LED Size
    const ledSizeRow = createRow('LED Size (px)');
    const ledSizeSlider = document.createElement('ha-slider');
    ledSizeSlider.style.cssText = 'flex:1;';
    ledSizeSlider.min = 4;
    ledSizeSlider.max = 20;
    ledSizeSlider.step = 1;
    ledSizeSlider.value = config.led_size || 10;
    ledSizeSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue3.textContent = val;
      this._updateConfig('led_size', val);
    });
    const sliderValue3 = document.createElement('span');
    sliderValue3.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue3.textContent = config.led_size || 10;
    ledSizeRow.appendChild(ledSizeSlider);
    ledSizeRow.appendChild(sliderValue3);
    visualSection.appendChild(ledSizeRow);

    // Value Position
    const valuePosRow = createRow('Value Position');
    const valuePosSelect = document.createElement('ha-select');
    valuePosSelect.style.cssText = 'flex:1;';
    valuePosSelect.value = config.value_position || 'below';
    
    const option1 = document.createElement('mwc-list-item');
    option1.value = 'below';
    option1.textContent = 'Below';
    
    const option2 = document.createElement('mwc-list-item');
    option2.value = 'inside';
    option2.textContent = 'Inside';
    
    valuePosSelect.appendChild(option1);
    valuePosSelect.appendChild(option2);
    valuePosSelect.addEventListener('selected', (e) => {
      const item = e.target.selectedItem;
      if (item) this._updateConfig('value_position', item.value);
    });
    valuePosSelect.addEventListener('closed', (e) => e.stopPropagation());
    valuePosRow.appendChild(valuePosSelect);
    visualSection.appendChild(valuePosRow);

    // Value Font Size
    const fontSizeRow = createRow('Value Font Size');
    const fontSizeInput = document.createElement('ha-textfield');
    fontSizeInput.style.cssText = 'flex:1;';
    fontSizeInput.type = 'number';
    fontSizeInput.value = config.value_font_size !== undefined ? config.value_font_size : '';
    fontSizeInput.placeholder = 'Auto';
    fontSizeInput.addEventListener('change', (e) => {
      const val = e.target.value === '' ? null : parseFloat(e.target.value);
      this._updateConfig('value_font_size', val);
    });
    fontSizeRow.appendChild(fontSizeInput);
    visualSection.appendChild(fontSizeRow);

    // Value Offset Y
    const offsetRow = createRow('Value Offset Y');
    const offsetSlider = document.createElement('ha-slider');
    offsetSlider.style.cssText = 'flex:1;';
    offsetSlider.min = -50;
    offsetSlider.max = 50;
    offsetSlider.step = 1;
    offsetSlider.value = config.value_offset_y || 0;
    offsetSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue4.textContent = val;
      this._updateConfig('value_offset_y', val);
    });
    const sliderValue4 = document.createElement('span');
    sliderValue4.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue4.textContent = config.value_offset_y || 0;
    offsetRow.appendChild(offsetSlider);
    offsetRow.appendChild(sliderValue4);
    visualSection.appendChild(offsetRow);

    container.appendChild(visualSection);

    // ===== SECTION: Colors =====
    const colorsSection = createSection('Colors');

    // Text Color
    const textColorRow = createRow('Text Color');
    const textColorInput = document.createElement('ha-textfield');
    textColorInput.style.cssText = 'flex:1;';
    textColorInput.value = config.text_color || '';
    textColorInput.placeholder = '#fff';
    textColorInput.addEventListener('change', (e) => {
      this._updateConfig('text_color', e.target.value);
    });
    textColorRow.appendChild(textColorInput);
    colorsSection.appendChild(textColorRow);

    // Unit Color
    const unitColorRow = createRow('Unit Color');
    const unitColorInput = document.createElement('ha-textfield');
    unitColorInput.style.cssText = 'flex:1;';
    unitColorInput.value = config.unit_color || '';
    unitColorInput.placeholder = '#ddd';
    unitColorInput.addEventListener('change', (e) => {
      this._updateConfig('unit_color', e.target.value);
    });
    unitColorRow.appendChild(unitColorInput);
    colorsSection.appendChild(unitColorRow);

    // Title Color
    const titleColorRow = createRow('Title Color');
    const titleColorInput = document.createElement('ha-textfield');
    titleColorInput.style.cssText = 'flex:1;';
    titleColorInput.value = config.title_color || '';
    titleColorInput.placeholder = '#fff';
    titleColorInput.addEventListener('change', (e) => {
      this._updateConfig('title_color', e.target.value);
    });
    titleColorRow.appendChild(titleColorInput);
    colorsSection.appendChild(titleColorRow);

    // Card Background
    const cardBgRow = createRow('Card Background');
    const cardBgInput = document.createElement('ha-textfield');
    cardBgInput.style.cssText = 'flex:1;';
    cardBgInput.value = config.card_background || '';
    cardBgInput.placeholder = '#222 or gradient';
    cardBgInput.addEventListener('change', (e) => {
      this._updateConfig('card_background', e.target.value);
    });
    cardBgRow.appendChild(cardBgInput);
    colorsSection.appendChild(cardBgRow);

    // Gauge Background
    const gaugeBgRow = createRow('Gauge Background');
    const gaugeBgInput = document.createElement('ha-textfield');
    gaugeBgInput.style.cssText = 'flex:1;';
    gaugeBgInput.value = config.gauge_background || '';
    gaugeBgInput.placeholder = '#333 or gradient';
    gaugeBgInput.addEventListener('change', (e) => {
      this._updateConfig('gauge_background', e.target.value);
    });
    gaugeBgRow.appendChild(gaugeBgInput);
    colorsSection.appendChild(gaugeBgRow);

    container.appendChild(colorsSection);

    // ===== SECTION: Shadows =====
    const shadowsSection = createSection('Shadows');

    // Enable Shadow
    const enableShadowRow = createRow('Enable Shadow');
    const enableShadowSwitch = document.createElement('ha-switch');
    enableShadowSwitch.style.cssText = 'margin-left:auto;';
    enableShadowSwitch.checked = config.enable_shadow || false;
    enableShadowSwitch.addEventListener('change', (e) => {
      this._updateConfig('enable_shadow', e.target.checked);
    });
    const enableShadowFormfield = document.createElement('ha-formfield');
    enableShadowFormfield.style.cssText = 'flex:1;';
    enableShadowFormfield.appendChild(enableShadowSwitch);
    enableShadowRow.appendChild(enableShadowFormfield);
    shadowsSection.appendChild(enableShadowRow);

    // Background Shadow
    const bgShadowRow = createRow('Background Shadow');
    const bgShadowSwitch = document.createElement('ha-switch');
    bgShadowSwitch.style.cssText = 'margin-left:auto;';
    bgShadowSwitch.checked = config.background_shadow || false;
    bgShadowSwitch.addEventListener('change', (e) => {
      this._updateConfig('background_shadow', e.target.checked);
    });
    const bgShadowFormfield = document.createElement('ha-formfield');
    bgShadowFormfield.style.cssText = 'flex:1;';
    bgShadowFormfield.appendChild(bgShadowSwitch);
    bgShadowRow.appendChild(bgShadowFormfield);
    shadowsSection.appendChild(bgShadowRow);

    // BG Shadow Intensity
    const bgIntensityRow = createRow('BG Shadow Intensity');
    const bgIntensitySlider = document.createElement('ha-slider');
    bgIntensitySlider.style.cssText = 'flex:1;';
    bgIntensitySlider.min = 0;
    bgIntensitySlider.max = 1;
    bgIntensitySlider.step = 0.1;
    bgIntensitySlider.value = config.background_shadow_intensity !== undefined ? config.background_shadow_intensity : 0.5;
    bgIntensitySlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue5.textContent = val;
      this._updateConfig('background_shadow_intensity', val);
    });
    const sliderValue5 = document.createElement('span');
    sliderValue5.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue5.textContent = config.background_shadow_intensity !== undefined ? config.background_shadow_intensity : 0.5;
    bgIntensityRow.appendChild(bgIntensitySlider);
    bgIntensityRow.appendChild(sliderValue5);
    shadowsSection.appendChild(bgIntensityRow);

    // Center Shadow
    const centerShadowRow = createRow('Center Shadow');
    const centerShadowSwitch = document.createElement('ha-switch');
    centerShadowSwitch.style.cssText = 'margin-left:auto;';
    centerShadowSwitch.checked = config.center_shadow || false;
    centerShadowSwitch.addEventListener('change', (e) => {
      this._updateConfig('center_shadow', e.target.checked);
    });
    const centerShadowFormfield = document.createElement('ha-formfield');
    centerShadowFormfield.style.cssText = 'flex:1;';
    centerShadowFormfield.appendChild(centerShadowSwitch);
    centerShadowRow.appendChild(centerShadowFormfield);
    shadowsSection.appendChild(centerShadowRow);

    // Center Shadow Blur
    const centerBlurRow = createRow('Center Shadow Blur');
    const centerBlurSlider = document.createElement('ha-slider');
    centerBlurSlider.style.cssText = 'flex:1;';
    centerBlurSlider.min = 10;
    centerBlurSlider.max = 100;
    centerBlurSlider.step = 5;
    centerBlurSlider.value = config.center_shadow_blur || 35;
    centerBlurSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue6.textContent = val;
      this._updateConfig('center_shadow_blur', val);
    });
    const sliderValue6 = document.createElement('span');
    sliderValue6.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue6.textContent = config.center_shadow_blur || 35;
    centerBlurRow.appendChild(centerBlurSlider);
    centerBlurRow.appendChild(sliderValue6);
    shadowsSection.appendChild(centerBlurRow);

    // Center Shadow Spread
    const centerSpreadRow = createRow('Center Shadow Spread');
    const centerSpreadSlider = document.createElement('ha-slider');
    centerSpreadSlider.style.cssText = 'flex:1;';
    centerSpreadSlider.min = 5;
    centerSpreadSlider.max = 50;
    centerSpreadSlider.step = 5;
    centerSpreadSlider.value = config.center_shadow_spread || 20;
    centerSpreadSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue7.textContent = val;
      this._updateConfig('center_shadow_spread', val);
    });
    const sliderValue7 = document.createElement('span');
    sliderValue7.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue7.textContent = config.center_shadow_spread || 20;
    centerSpreadRow.appendChild(centerSpreadSlider);
    centerSpreadRow.appendChild(sliderValue7);
    shadowsSection.appendChild(centerSpreadRow);

    // Center Shadow Size
    const centerSizeRow = createRow('Center Shadow Size (%)');
    const centerSizeSlider = document.createElement('ha-slider');
    centerSizeSlider.style.cssText = 'flex:1;';
    centerSizeSlider.min = 30;
    centerSizeSlider.max = 100;
    centerSizeSlider.step = 5;
    centerSizeSlider.value = config.center_shadow_size || 70;
    centerSizeSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue8.textContent = val;
      this._updateConfig('center_shadow_size', val);
    });
    const sliderValue8 = document.createElement('span');
    sliderValue8.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue8.textContent = config.center_shadow_size || 70;
    centerSizeRow.appendChild(centerSizeSlider);
    centerSizeRow.appendChild(sliderValue8);
    shadowsSection.appendChild(centerSizeRow);

    container.appendChild(shadowsSection);

    // ===== SECTION: Transparency =====
    const transparencySection = createSection('Transparency');

    // Transparent Card
    const transCardRow = createRow('Transparent Card');
    const transCardSwitch = document.createElement('ha-switch');
    transCardSwitch.style.cssText = 'margin-left:auto;';
    transCardSwitch.checked = config.transparent_card || false;
    transCardSwitch.addEventListener('change', (e) => {
      this._updateConfig('transparent_card', e.target.checked);
    });
    const transCardFormfield = document.createElement('ha-formfield');
    transCardFormfield.style.cssText = 'flex:1;';
    transCardFormfield.appendChild(transCardSwitch);
    transCardRow.appendChild(transCardFormfield);
    transparencySection.appendChild(transCardRow);

    // Transparent Gauge
    const transGaugeRow = createRow('Transparent Gauge');
    const transGaugeSwitch = document.createElement('ha-switch');
    transGaugeSwitch.style.cssText = 'margin-left:auto;';
    transGaugeSwitch.checked = config.transparent_gauge || false;
    transGaugeSwitch.addEventListener('change', (e) => {
      this._updateConfig('transparent_gauge', e.target.checked);
    });
    const transGaugeFormfield = document.createElement('ha-formfield');
    transGaugeFormfield.style.cssText = 'flex:1;';
    transGaugeFormfield.appendChild(transGaugeSwitch);
    transGaugeRow.appendChild(transGaugeFormfield);
    transparencySection.appendChild(transGaugeRow);

    // Hide Inactive LEDs
    const hideLedsRow = createRow('Hide Inactive LEDs');
    const hideLedsSwitch = document.createElement('ha-switch');
    hideLedsSwitch.style.cssText = 'margin-left:auto;';
    hideLedsSwitch.checked = config.hide_inactive_leds || false;
    hideLedsSwitch.addEventListener('change', (e) => {
      this._updateConfig('hide_inactive_leds', e.target.checked);
    });
    const hideLedsFormfield = document.createElement('ha-formfield');
    hideLedsFormfield.style.cssText = 'flex:1;';
    hideLedsFormfield.appendChild(hideLedsSwitch);
    hideLedsRow.appendChild(hideLedsFormfield);
    transparencySection.appendChild(hideLedsRow);

    container.appendChild(transparencySection);

    // ===== SECTION: Animation =====
    const animationSection = createSection('Animation');

    // Smooth Transitions
    const smoothRow = createRow('Smooth Transitions');
    const smoothSwitch = document.createElement('ha-switch');
    smoothSwitch.style.cssText = 'margin-left:auto;';
    smoothSwitch.checked = config.smooth_transitions !== false;
    smoothSwitch.addEventListener('change', (e) => {
      this._updateConfig('smooth_transitions', e.target.checked);
    });
    const smoothFormfield = document.createElement('ha-formfield');
    smoothFormfield.style.cssText = 'flex:1;';
    smoothFormfield.appendChild(smoothSwitch);
    smoothRow.appendChild(smoothFormfield);
    animationSection.appendChild(smoothRow);

    // Animation Duration
    const animDurationRow = createRow('Animation Duration (ms)');
    const animDurationSlider = document.createElement('ha-slider');
    animDurationSlider.style.cssText = 'flex:1;';
    animDurationSlider.min = 100;
    animDurationSlider.max = 2000;
    animDurationSlider.step = 100;
    animDurationSlider.value = config.animation_duration || 800;
    animDurationSlider.addEventListener('change', (e) => {
      const val = parseFloat(e.target.value);
      sliderValue9.textContent = val;
      this._updateConfig('animation_duration', val);
    });
    const sliderValue9 = document.createElement('span');
    sliderValue9.style.cssText = 'flex:0 0 50px;text-align:right;font-size:14px;color:var(--secondary-text-color);';
    sliderValue9.textContent = config.animation_duration || 800;
    animDurationRow.appendChild(animDurationSlider);
    animDurationRow.appendChild(sliderValue9);
    animationSection.appendChild(animDurationRow);

    container.appendChild(animationSection);

    // ===== SECTION: Severity =====
    const severitySection = createSection('Color Thresholds (Severity)');

    if (config.severity && config.severity.length > 0) {
      config.severity.forEach((item, index) => {
        const severityRow = document.createElement('div');
        severityRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';

        const valueInput = document.createElement('ha-textfield');
        valueInput.style.cssText = 'flex:0 0 80px;';
        valueInput.type = 'number';
        valueInput.value = item.value;
        valueInput.placeholder = 'Value %';
        valueInput.addEventListener('change', (e) => {
          this._updateSeverity(index, 'value', parseFloat(e.target.value) || 0);
        });

        const colorInput = document.createElement('ha-textfield');
        colorInput.style.cssText = 'flex:1;';
        colorInput.value = item.color;
        colorInput.placeholder = '#4caf50';
        colorInput.addEventListener('change', (e) => {
          this._updateSeverity(index, 'color', e.target.value);
        });

        const removeBtn = document.createElement('ha-icon-button');
        removeBtn.title = 'Remove';
        removeBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/></svg>';
        removeBtn.addEventListener('click', () => {
          this._removeSeverity(index);
        });

        severityRow.appendChild(valueInput);
        severityRow.appendChild(colorInput);
        severityRow.appendChild(removeBtn);
        severitySection.appendChild(severityRow);
      });
    } else {
      const noSeverity = document.createElement('div');
      noSeverity.style.cssText = 'color:var(--secondary-text-color);font-size:12px;margin-bottom:8px;';
      noSeverity.textContent = 'No thresholds defined. Using defaults.';
      severitySection.appendChild(noSeverity);
    }

    const addBtn = document.createElement('ha-button');
    addBtn.style.cssText = 'margin-top:8px;';
    addBtn.textContent = 'Add Threshold';
    addBtn.addEventListener('click', () => this._addSeverity());
    severitySection.appendChild(addBtn);

    container.appendChild(severitySection);

    this.appendChild(container);
  }

  _updateSeverity(index, field, value) {
    const severity = [...(this._config.severity || [])];
    severity[index] = { ...severity[index], [field]: value };
    this._updateConfig('severity', severity);
  }

  _addSeverity() {
    const severity = [...(this._config.severity || [])];
    severity.push({ 
      color: '#4caf50', 
      value: severity.length > 0 ? Math.min(100, severity[severity.length - 1].value + 33) : 33 
    });
    this._updateConfig('severity', severity);
    this._render();
  }

  _removeSeverity(index) {
    const severity = [...(this._config.severity || [])];
    severity.splice(index, 1);
    this._updateConfig('severity', severity.length > 0 ? severity : undefined);
    this._render();
  }

  _updateConfig(key, value) {
    const newConfig = { ...this._config };
    
    if (value === undefined || value === null || value === '') {
      delete newConfig[key];
    } else {
      newConfig[key] = value;
    }
    
    this._config = newConfig;
    
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true
    }));
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
  '%c HALF-GAUGE-CARD %c v1.0.0 ',
  'color: white; font-weight: bold; background: #ff9800;',
  'color: white; font-weight: bold; background: #333;'
);
