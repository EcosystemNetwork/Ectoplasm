/**
 * Ectoplasm DEX - Modern Animations Module
 * 
 * Implements smooth, performant animations throughout the platform
 * Inspired by react-bits animation library, adapted for vanilla JavaScript
 * 
 * Features:
 * - Scroll-triggered content reveals
 * - Smooth fade and slide animations
 * - Hover effects for interactive elements
 * - Respects user's prefers-reduced-motion preference
 * - Optimized for 60fps performance
 * - Works with or without GSAP (graceful fallback to CSS animations)
 * 
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  const config = {
    // Animation durations (in milliseconds for Web Animations API)
    duration: {
      fast: 300,
      normal: 600,
      slow: 1000,
    },
    // Easing functions (CSS compatible)
    ease: {
      smooth: 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
      elastic: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    },
    // Scroll trigger thresholds
    scrollThreshold: 0.15, // Start animation when 15% visible
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Check if user prefers reduced motion
   * @returns {boolean} True if reduced motion is preferred
   */
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ============================================================================
  // ANIMATION FUNCTIONS (CSS-based with Intersection Observer)
  // ============================================================================

  /**
   * Create an Intersection Observer for scroll-triggered animations
   * @returns {IntersectionObserver}
   */
  function createScrollObserver(callback) {
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback(entry.target);
          }
        });
      },
      {
        threshold: config.scrollThreshold,
        rootMargin: '50px'
      }
    );
  }

  /**
   * Initialize fade-in animations for elements
   * Elements fade in and optionally slide up when they enter viewport
   */
  function initFadeInAnimations() {
    if (prefersReducedMotion()) return;

    const elements = document.querySelectorAll('[data-animate="fade-in"], .feature-card, .stats-item, .roadmap-item');
    
    const observer = createScrollObserver((el) => {
      el.style.animation = `fadeIn ${config.duration.normal}ms ${config.ease.smooth} forwards`;
      observer.unobserve(el);
    });

    elements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.animationDelay = `${index * 100}ms`;
      observer.observe(el);
    });
  }

  /**
   * Initialize slide-in animations for cards and sections
   */
  function initSlideInAnimations() {
    if (prefersReducedMotion()) return;

    const leftElements = document.querySelectorAll('[data-animate="slide-left"]');
    const rightElements = document.querySelectorAll('[data-animate="slide-right"]');

    const observer = createScrollObserver((el) => {
      const direction = el.getAttribute('data-animate');
      el.style.animation = `${direction === 'slide-left' ? 'slideLeft' : 'slideRight'} ${config.duration.normal}ms ${config.ease.smooth} forwards`;
      observer.unobserve(el);
    });

    leftElements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50px)';
      el.style.animationDelay = `${index * 150}ms`;
      observer.observe(el);
    });

    rightElements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(50px)';
      el.style.animationDelay = `${index * 150}ms`;
      observer.observe(el);
    });
  }

  /**
   * Initialize scale animations for hero elements
   */
  function initScaleAnimations() {
    if (prefersReducedMotion()) return;

    const elements = document.querySelectorAll('[data-animate="scale"]');
    
    const observer = createScrollObserver((el) => {
      el.style.animation = `scaleIn ${config.duration.slow}ms ${config.ease.bounce} forwards`;
      observer.unobserve(el);
    });

    elements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.transform = 'scale(0.8)';
      el.style.animationDelay = `${index * 100}ms`;
      observer.observe(el);
    });
  }

  /**
   * Initialize blur fade animations
   */
  function initBlurFadeAnimations() {
    if (prefersReducedMotion()) return;

    const elements = document.querySelectorAll('[data-animate="blur-fade"]');
    
    const observer = createScrollObserver((el) => {
      el.style.animation = `blurFadeIn ${config.duration.slow}ms ${config.ease.smooth} forwards`;
      observer.unobserve(el);
    });

    elements.forEach((el, index) => {
      el.style.opacity = '0';
      el.style.filter = 'blur(10px)';
      el.style.animationDelay = `${index * 100}ms`;
      observer.observe(el);
    });
  }

  /**
   * Initialize stagger animations for lists
   */
  function initStaggerAnimations() {
    if (prefersReducedMotion()) return;

    const containers = document.querySelectorAll('[data-animate="stagger"]');
    
    containers.forEach(container => {
      const children = Array.from(container.children);
      
      const observer = createScrollObserver((el) => {
        children.forEach((child, index) => {
          child.style.opacity = '0';
          child.style.transform = 'translateY(20px)';
          setTimeout(() => {
            child.style.transition = `opacity ${config.duration.normal}ms ${config.ease.smooth}, transform ${config.duration.normal}ms ${config.ease.smooth}`;
            child.style.opacity = '1';
            child.style.transform = 'translateY(0)';
          }, index * 100);
        });
        observer.unobserve(el);
      });
      
      observer.observe(container);
    });
  }

  /**
   * Initialize hover animations for interactive elements
   */
  function initHoverAnimations() {
    if (prefersReducedMotion()) return;

    // This is handled by CSS in animations.css
    // Just ensure elements have proper transitions
    const interactiveElements = document.querySelectorAll(
      '.btn, .feature-card, .quest-card, .reward-item, .menu-item, [data-animate-hover]'
    );
    
    interactiveElements.forEach(el => {
      if (!el.style.transition) {
        el.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
      }
    });
  }

  /**
   * Initialize hero section animations
   */
  function initHeroAnimations() {
    if (prefersReducedMotion()) return;

    // Animate hero heading
    const heroHeading = document.querySelector('.swap-heading h1, .hero h1');
    if (heroHeading) {
      heroHeading.style.opacity = '0';
      heroHeading.style.transform = 'translateY(50px)';
      setTimeout(() => {
        heroHeading.style.transition = `opacity ${config.duration.slow}ms ${config.ease.smooth}, transform ${config.duration.slow}ms ${config.ease.smooth}`;
        heroHeading.style.opacity = '1';
        heroHeading.style.transform = 'translateY(0)';
      }, 200);
    }

    // Animate swap card with bounce
    const swapCard = document.querySelector('.swap-shell, .hero-card');
    if (swapCard) {
      swapCard.style.opacity = '0';
      swapCard.style.transform = 'scale(0.9) translateY(30px)';
      setTimeout(() => {
        swapCard.style.transition = `opacity ${config.duration.slow}ms ${config.ease.bounce}, transform ${config.duration.slow}ms ${config.ease.bounce}`;
        swapCard.style.opacity = '1';
        swapCard.style.transform = 'scale(1) translateY(0)';
      }, 400);
    }

    // Animate navigation
    const nav = document.querySelector('.nav');
    if (nav) {
      nav.style.opacity = '0';
      nav.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        nav.style.transition = `opacity ${config.duration.normal}ms ${config.ease.smooth}, transform ${config.duration.normal}ms ${config.ease.smooth}`;
        nav.style.opacity = '1';
        nav.style.transform = 'translateY(0)';
      }, 0);
    }
  }

  /**
   * Initialize click spark effect
   */
  function initClickSparkEffect() {
    if (prefersReducedMotion()) return;

    document.addEventListener('click', (e) => {
      // Only on interactive elements
      const isInteractive = e.target.closest('button, a, input, select');
      if (!isInteractive) return;

      const spark = document.createElement('div');
      spark.className = 'click-spark';
      spark.style.left = e.clientX + 'px';
      spark.style.top = e.clientY + 'px';
      document.body.appendChild(spark);

      // Animate with CSS
      spark.style.animation = 'clickSpark 0.6s ease-out forwards';
      
      setTimeout(() => spark.remove(), 600);
    });
  }

  /**
   * Initialize animated counters for statistics (simplified without GSAP)
   */
  function initCounterAnimations() {
    if (prefersReducedMotion()) return;

    const counters = document.querySelectorAll('[data-counter]');
    
    const observer = createScrollObserver((counter) => {
      const targetValue = parseFloat(counter.getAttribute('data-counter'));
      const duration = parseFloat(counter.getAttribute('data-counter-duration')) || 2;
      const startTime = Date.now();
      const startValue = 0;
      
      function updateCounter() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / (duration * 1000), 1);
        const currentValue = startValue + (targetValue - startValue) * progress;
        
        counter.textContent = Math.floor(currentValue).toLocaleString();
        
        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        }
      }
      
      updateCounter();
      observer.unobserve(counter);
    });
    
    counters.forEach(counter => observer.observe(counter));
  }

  /**
   * Initialize parallax effect for liquid blobs (simplified)
   */
  function initParallaxEffect() {
    if (prefersReducedMotion()) return;

    const blobs = document.querySelectorAll('.liquid-blob');
    if (blobs.length === 0) return;
    
    window.addEventListener('scroll', () => {
      const scrollY = window.pageYOffset;
      blobs.forEach((blob, index) => {
        const speed = 0.5 + (index * 0.1);
        blob.style.transform = `translateY(${scrollY * speed * 0.1}px)`;
      });
    }, { passive: true });
  }

  /**
   * Add smooth scroll behavior
   */
  function initSmoothScroll() {
    const links = document.querySelectorAll('a[href^="#"]');
    
    links.forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href === '#') return;
        
        const target = document.querySelector(href);
        if (!target) return;
        
        e.preventDefault();
        
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - 80;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      });
    });
  }

  /**
   * Initialize page transition effect
   */
  function initPageTransition() {
    if (prefersReducedMotion()) return;

    // Fade in page on load
    document.body.style.opacity = '0';
    setTimeout(() => {
      document.body.style.transition = 'opacity 0.4s ease';
      document.body.style.opacity = '1';
    }, 0);
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  /**
   * Initialize all animations
   */
  function initAnimations() {
    try {
      // If reduced motion is preferred, skip most animations
      if (prefersReducedMotion()) {
        console.log('✨ Reduced motion preference detected - animations limited');
        return;
      }

      // Initialize all animation types
      initPageTransition();
      initHeroAnimations();
      initFadeInAnimations();
      initSlideInAnimations();
      initScaleAnimations();
      initBlurFadeAnimations();
      initStaggerAnimations();
      initHoverAnimations();
      initCounterAnimations();
      initParallaxEffect();
      initClickSparkEffect();
      initSmoothScroll();

      console.log('✨ Animations initialized successfully (CSS-based)');
    } catch (error) {
      console.error('Failed to initialize animations:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimations);
  } else {
    initAnimations();
  }

  // Expose public API
  window.EctoplasmAnimations = {
    init: initAnimations,
    config: config
  };
})();
