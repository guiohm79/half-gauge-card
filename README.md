# Half Gauge Card

A simple and elegant Home Assistant card displaying a half-circle gauge (180°).

## Installation

1. Copy `half-gauge-card.js` to your `www/community/half-gauge-card/` or `config/www/` folder
2. Add the resource in Home Assistant:
   - **YAML Mode**: Add to `configuration.yaml`:
     ```yaml
     lovelace:
       resources:
         - url: /local/half-gauge-card.js
           type: module
     ```
   - **UI Mode**: Configuration > Dashboards > Resources > Add Resource

## Configuration

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **required** | Entity to display |
| `name` | string | | Name displayed under the gauge |
| `unit` | string | | Unit to display (%, °C, etc.) |
| `min` | number | 0 | Minimum value |
| `max` | number | 100 | Maximum value |
| `decimals` | number | 0 | Number of decimal places |

### Visual Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `gauge_size` | number | 200 | Gauge size (px) |
| `center_size` | number | 120 | Center size (px) |
| `leds_count` | number | 60 | Number of LEDs |
| `led_size` | number | 10 | LED size (px) |
| `hide_inactive_leds` | boolean | false | Hide inactive LEDs |
| `card_background` | string | #222 | Card background color or gradient. Supports: hex colors (`#222`, `#ff0000`), `transparent`, CSS gradients like `linear-gradient(135deg, #1a1a2e, #16213e)` or `radial-gradient(circle, #333, #111)` |
| `gauge_background` | string | #333 | Gauge background color or gradient. Supports: hex colors (`#fff`, `#ff0000`), `transparent`, CSS gradients like `linear-gradient(to right, #333, #666)` or `radial-gradient(circle, #444, #222)` |
| `text_color` | string | #fff | Value color |
| `unit_color` | string | #ddd | Unit color |
| `title_color` | string | #fff | Title color |

### Shadows

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enable_shadow` | boolean | false | Colored shadow around the card |
| `background_shadow` | boolean | false | Apply severity color to the card background gradient. The gradient colors are replaced with the severity color at varying opacities |
| `background_shadow_intensity` | number | 0.5 | Intensity of the background shadow (0 to 1). 0 = invisible, 0.1 = very subtle, 0.5 = moderate, 1 = strong |
| `center_shadow` | boolean | false | Colored shadow in the center |
| `center_shadow_blur` | number | 30 | Center shadow blur |
| `center_shadow_spread` | number | 15 | Center shadow spread |
| `center_shadow_size` | number | 70 | Center shadow size (% of radius) |

### Transparency

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `transparent_card` | boolean | false | Transparent card background |
| `transparent_gauge` | boolean | false | Transparent gauge background |

### Value Position

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `value_position` | string | 'below' | 'below' = under the gauge, 'inside' = inside the gauge |
| `value_font_size` | number | null | Custom font size for the value (pixels). Default: 36 for 'below', 32 for 'inside' |
| `value_offset_y` | number | 0 | Vertical offset for the value display (pixels). Positive values move down, negative move up |

### Animation

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `smooth_transitions` | boolean | true | Smooth animation of changes |
| `animation_duration` | number | 800 | Animation duration (ms) |

### Color Thresholds (severity)

```yaml
type: custom:half-gauge-card
entity: sensor.humidity
severity:
  - color: '#00bfff'  # Blue
    value: 0
  - color: '#4caf50'  # Green
    value: 40
  - color: '#ff9800'  # Orange
    value: 70
  - color: '#f44336'  # Red
    value: 90
```

## Complete Example

```yaml
type: custom:half-gauge-card
entity: sensor.living_room_humidity
name: Living Room Humidity
unit: '%'
min: 0
max: 100
decimals: 0
leds_count: 50
gauge_size: 220
center_shadow: true
center_shadow_blur: 40
center_shadow_spread: 20
severity:
  - color: '#4caf50'
    value: 40
  - color: '#ff9800'
    value: 60
  - color: '#f44336'
    value: 80
```

## Screenshots

The card displays a half-circle gauge with:
- Minimum value on the left
- Maximum value on the right
- Current value and unit displayed under the gauge
- LEDs colored according to defined thresholds

## License

MIT
