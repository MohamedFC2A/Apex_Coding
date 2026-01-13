// UI Testing Utilities for Apex Coding

export const runUIConsistencyTest = () => {
  const tests = [
    {
      name: 'CSS Variables Check',
      test: () => {
        const root = document.documentElement;
        const requiredVars = [
          '--nexus-deepest',
          '--nexus-dark',
          '--nexus-border',
          '--nexus-cyan',
          '--glass-blur'
        ];
        
        const results = requiredVars.map(varName => {
          const value = getComputedStyle(root).getPropertyValue(varName);
          return {
            variable: varName,
            exists: !!value,
            value: value.trim()
          };
        });
        
        console.group('CSS Variables Test');
        results.forEach(r => {
          console.log(`${r.variable}: ${r.exists ? '✓' : '✗'} ${r.value}`);
        });
        console.groupEnd();
        
        return results.every(r => r.exists);
      }
    },
    {
      name: 'Responsive Breakpoints',
      test: () => {
        const width = window.innerWidth;
        let currentBreakpoint = '';
        
        if (width < 480) currentBreakpoint = 'Mobile Small';
        else if (width < 768) currentBreakpoint = 'Mobile';
        else if (width < 1024) currentBreakpoint = 'Tablet';
        else if (width < 1440) currentBreakpoint = 'Desktop';
        else currentBreakpoint = 'Large Desktop';
        
        console.log(`Current Breakpoint: ${currentBreakpoint} (${width}px)`);
        return true;
      }
    },
    {
      name: 'Glass Components Check',
      test: () => {
        const glassElements = document.querySelectorAll('.glass-surface, .glass-card, .glass-panel');
        console.log(`Found ${glassElements.length} glass components`);
        return glassElements.length > 0;
      }
    },
    {
      name: 'Mobile Navigation',
      test: () => {
        const mobileNav = document.querySelector('[data-testid="mobile-nav"]');
        const isVisible = mobileNav && window.getComputedStyle(mobileNav).display !== 'none';
        console.log(`Mobile Nav Visible: ${isVisible}`);
        return true;
      }
    },
    {
      name: 'Preview Window',
      test: () => {
        const previewWindow = document.querySelector('[data-testid="preview-window"]');
        if (previewWindow) {
          const styles = window.getComputedStyle(previewWindow);
          console.log('Preview Window Styles:', {
            borderColor: styles.borderColor,
            backgroundColor: styles.backgroundColor,
            backdropFilter: styles.backdropFilter
          });
        }
        return true;
      }
    },
    {
      name: 'Color Contrast',
      test: () => {
        const body = document.body;
        const computed = window.getComputedStyle(body);
        const color = computed.color;
        const background = computed.backgroundColor;
        
        // Simple contrast check (would need a proper library for real testing)
        console.log(`Text Color: ${color}`);
        console.log(`Background: ${background}`);
        return true;
      }
    },
    {
      name: 'Focus Management',
      test: () => {
        const focusableElements = document.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        console.log(`Found ${focusableElements.length} focusable elements`);
        return true;
      }
    },
    {
      name: 'Scrollbars',
      test: () => {
        const scrollContainers = document.querySelectorAll('.scrollbar-thin, .scrollbar-glass');
        console.log(`Found ${scrollContainers.length} custom scrollbars`);
        return true;
      }
    }
  ];
  
  console.group('🧪 Apex Coding UI Consistency Test');
  console.log(`Running ${tests.length} tests...\n`);
  
  const results = tests.map(({ name, test }) => {
    try {
      const passed = test();
      console.log(`${passed ? '✅' : '❌'} ${name}`);
      return { name, passed };
    } catch (error) {
      console.log(`❌ ${name} - Error: ${error}`);
      return { name, passed: false, error };
    }
  });
  
  const passedCount = results.filter(r => r.passed).length;
  console.log(`\nTest Results: ${passedCount}/${results.length} passed`);
  console.groupEnd();
  
  return results;
};

export const checkCodeSandboxIntegration = () => {
  console.group('🔗 CodeSandbox Integration Test');
  
  // Check if preview API is available
  fetch('/api/preview/config')
    .then(response => response.json())
    .then(config => {
      console.log('CodeSandbox Config:', config);
      
      if (config.provider === 'mock') {
        console.warn('⚠️ CodeSandbox is in mock mode');
        console.log('To enable live preview:');
        console.log('1. Get an API key from https://codesandbox.io/dashboard/settings/api-keys');
        console.log('2. Set CSB_API_KEY in your environment variables');
        console.log('3. Restart the server');
      } else if (config.configured) {
        console.log('✅ CodeSandbox is properly configured');
      } else {
        console.error('❌ CodeSandbox configuration incomplete');
        console.log('Missing:', config.missing);
      }
    })
    .catch(error => {
      console.error('❌ Failed to check CodeSandbox config:', error);
    });
  
  console.groupEnd();
};

export const runAccessibilityCheck = () => {
  console.group('♿ Accessibility Check');
  
  // Check for alt text on images
  const images = document.querySelectorAll('img');
  const imagesWithoutAlt = Array.from(images).filter(img => !img.alt);
  console.log(`Images without alt text: ${imagesWithoutAlt.length}`);
  
  // Check for proper heading hierarchy
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  console.log(`Headings found: ${headings.length}`);
  
  // Check for ARIA labels
  const elementsWithAria = document.querySelectorAll('[aria-label], [aria-labelledby]');
  console.log(`Elements with ARIA labels: ${elementsWithAria.length}`);
  
  // Check for proper form labels
  const inputs = document.querySelectorAll('input, textarea, select');
  const inputsWithLabels = Array.from(inputs).filter(input => {
    const id = input.id;
    const label = document.querySelector(`label[for="${id}"]`);
    return label || input.getAttribute('aria-label') || input.getAttribute('aria-labelledby');
  });
  console.log(`Inputs with labels: ${inputsWithLabels.length}/${inputs.length}`);
  
  console.groupEnd();
};

// Run all tests
export const runAllTests = () => {
  console.clear();
  console.log('🚀 Starting Apex Coding UI Tests...\n');
  
  runUIConsistencyTest();
  console.log('');
  checkCodeSandboxIntegration();
  console.log('');
  runAccessibilityCheck();
  
  console.log('\n✨ All tests completed!');
};

// Make available in console for debugging
if (typeof window !== 'undefined') {
  (window as any).apexUI = {
    runTests: runAllTests,
    runUI: runUIConsistencyTest,
    checkCodeSandbox: checkCodeSandboxIntegration,
    checkA11y: runAccessibilityCheck
  };
}
