# Modern Hover-Triggered Animations

This document describes the modern hover animations implemented in Ectoplasm, inspired by the [react-bits](https://github.com/DavidHDev/react-bits) library and adapted to use native Web APIs with vanilla JavaScript.

## Overview

The animations are designed to be:
- **Performant**: GPU-accelerated transforms and optimized with `requestAnimationFrame`
- **Accessible**: Respects `prefers-reduced-motion` user preferences
- **Lightweight**: Pure vanilla JavaScript with no dependencies
- **Cross-browser**: Works on all modern browsers

## Animation Types

### 1. GlareHover Effect

A glare/shine effect that sweeps across elements on hover, creating a subtle highlight that follows the mouse direction.

**Applied to:**
- Hero cards (`.hero-card`)
- Feature cards (`.feature-card`)
- Quest cards (`.quest-card`)
- Mission cards (`.mission-card`)
- Launchpad cards (`.launchpad-card`)

**Implementation:**
- Pure CSS using `::before` pseudo-element
- Linear gradient background with position animation
- 650ms transition duration

**Usage:**
```html
<div class="hero-card glare-hover">
  Your content here
</div>
```

### 2. Magnet Effect

Elements are attracted toward the mouse cursor within a magnetic field radius, creating an interactive pull effect.

**Applied to:**
- Primary buttons (`.btn.primary`)

**Implementation:**
- JavaScript-based using `requestAnimationFrame`
- Smooth interpolation for natural movement
- Configurable strength and padding via data attributes

**Usage:**
```html
<button class="btn primary magnet-hover" 
        data-magnet-padding="60" 
        data-magnet-strength="3">
  Click me
</button>
```

**Configuration:**
- `data-magnet-padding`: Distance in pixels for magnetic field (default: 100)
- `data-magnet-strength`: Divisor for movement (lower = stronger pull, default: 2)

### 3. Shimmer Effect

A subtle shimmer animation that runs across elements on hover, like a wave of light.

**Applied to:**
- Reward cards (`.reward-card`)

**Implementation:**
- CSS using `::after` pseudo-element
- Gradient animation from left to right
- 600ms transition duration

**Usage:**
```html
<div class="reward-card shimmer-hover">
  Your content here
</div>
```

### 4. Tilt Effect

Creates a 3D perspective tilt effect based on mouse position, making elements feel interactive and dimensional.

**Applied to:**
- Icon buttons (`.icon-btn`)

**Implementation:**
- JavaScript-based mouse tracking
- CSS 3D transforms with `perspective`
- Smooth reset on mouse leave

**Usage:**
```html
<button class="icon-btn tilt-hover" data-tilt-max="8">
  ⚙️
</button>
```

**Configuration:**
- `data-tilt-max`: Maximum tilt angle in degrees (default: 10)

### 5. Glow Effect

Adds a soft glow around elements on hover, with animated border color change.

**Applied to:**
- Available as utility class for any element

**Usage:**
```html
<div class="card glow-hover">
  Your content here
</div>
```

### 6. Float Effect

Makes elements lift up slightly on hover with enhanced shadow.

**Applied to:**
- Available as utility class for any element

**Usage:**
```html
<div class="card float-hover">
  Your content here
</div>
```

## JavaScript API

The animations expose a global API for manual control:

```javascript
// Initialize all animations
window.EctoplasmAnimations.init();

// Cleanup all animations
window.EctoplasmAnimations.cleanup();

// Apply animation to specific element
const element = document.querySelector('.my-element');
window.EctoplasmAnimations.applyToElement(element, 'glare'); // or 'magnet', 'tilt', etc.
```

## Accessibility

All animations respect the user's motion preferences:

```css
@media (prefers-reduced-motion: reduce) {
  /* All animations are disabled */
}
```

The JavaScript also checks for reduced motion preference:
```javascript
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  // Skip animation initialization
}
```

## Performance Optimizations

1. **GPU Acceleration**: Uses `transform3d` and `will-change` properties
2. **Passive Event Listeners**: Improves scroll performance
3. **RequestAnimationFrame**: Smooth 60fps animations
4. **Cleanup Functions**: Prevents memory leaks
5. **Conditional Initialization**: Only applies to existing elements

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Opera 74+

All animations gracefully degrade in older browsers.

## Examples

### Combining Multiple Effects

```html
<!-- Card with glare and float effects -->
<div class="hero-card glare-hover float-hover">
  <h3>Combined Effects</h3>
  <p>This card has both glare and float animations</p>
</div>
```

### Custom Configuration

```html
<!-- Button with strong magnet effect -->
<button class="btn primary magnet-hover" 
        data-magnet-padding="120" 
        data-magnet-strength="1.5">
  Strong Pull
</button>

<!-- Element with subtle tilt -->
<div class="card tilt-hover" data-tilt-max="5">
  Subtle 3D Effect
</div>
```

## Debugging

To debug animations, open the browser console:
- Successful initialization: `"Modern hover animations initialized"`
- Reduced motion detected: `"Hover animations disabled due to user preference for reduced motion"`

## Credits

Inspired by [react-bits](https://github.com/DavidHDev/react-bits) by David Haz.
Adapted to vanilla JavaScript with native Web APIs for the Ectoplasm DEX platform.
