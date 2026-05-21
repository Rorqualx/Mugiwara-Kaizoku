/**
 * Tests for ProgressiveImage Component
 */

/* eslint-disable no-undef */ // Image is properly mocked globally for Jest

import React from 'react';

import { MantineProvider } from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import { render, waitFor } from '@testing-library/react';

import { ProgressiveImage, preloadImage, generateSrcSet } from '../ProgressiveImage';

// Properly mock the global Image constructor for Jest
global.Image = jest.fn() as jest.MockedClass<typeof Image>;


// Mock intersection observer
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn()
});
Object.defineProperty(window, 'IntersectionObserver', {
  writable: true,
  configurable: true,
  value: mockIntersectionObserver as jest.Mock
});

// Mock @mantine/hooks with proper implementations
jest.mock('@mantine/hooks', () => {
  const actual = jest.requireActual<Record<string, unknown>>('@mantine/hooks');
  return {
    ...actual,
    useIntersection: jest.fn().mockReturnValue({
      ref: { current: null },
      entry: { isIntersecting: true }
    }),
    useViewportSize: jest.fn().mockReturnValue({ width: 1024, height: 768 }),
    useMediaQuery: jest.fn().mockReturnValue(false)
  };
});

// Cast the imported mock to access jest.Mock methods
const mockUseIntersection = useIntersection as jest.Mock;

// Mock mobile detection
jest.mock('../../../hooks/mobile', (): { useBreakpoint: jest.Mock } => ({
  useBreakpoint: jest.fn((): { isMobile: boolean; isTablet: boolean; isDesktop: boolean } => ({
    isMobile: false,
    isTablet: false,
    isDesktop: true
  }))
}));

describe('ProgressiveImage', () => {
  const defaultProps = {
    src: 'https://example.com/image.jpg',
    alt: 'Test image'
  };

  const renderComponent = (props?: Partial<React.ComponentProps<typeof ProgressiveImage>>): ReturnType<typeof render> => {
    return render(
      <MantineProvider>
        <ProgressiveImage {...defaultProps} {...props} />
      </MantineProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset useIntersection mock to default state
    mockUseIntersection.mockReturnValue({
      ref: { current: null },
      entry: { isIntersecting: true }
    });

    // Reset Image mock with simplified approach
    const mockImage = jest.fn(() => ({
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'load') {
          setTimeout(handler, 10);
        }
      }),
      removeEventListener: jest.fn(),
      src: '',
      srcset: '',
      sizes: ''
    }));
    global.Image = mockImage as unknown as jest.MockedClass<typeof Image>;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders with loading state initially', () => {
    const { container } = renderComponent({ loadingType: 'skeleton' });
    const skeleton = container.querySelector('.mantine-Skeleton-root');
    expect(skeleton).not.toBeNull();
  });

  it('shows placeholder image when provided', () => {
    const placeholder = 'data:image/jpeg;base64,placeholder';
    const { getByLabelText } = renderComponent({
      placeholder,
      loadingType: 'blur'
    });

    const placeholderDiv = getByLabelText('Loading Test image');
    expect(placeholderDiv).toBeInTheDocument();
    expect(placeholderDiv).toHaveStyle({
      filter: 'blur(20px)',
      backgroundImage: `url(${placeholder})`
    });
  });

  it('loads high-quality image when in viewport', async () => {
    const { getAllByRole } = renderComponent();

    await waitFor(() => {
      const images = getAllByRole('img');
      const img = images[0];
      expect(img).toHaveAttribute('src', defaultProps.src);
    });
  });

  it('uses native lazy loading when specified', async () => {
    const { getAllByRole } = renderComponent({
      lazy: true,
      useNativeLazy: true
    });

    await waitFor(() => {
      const images = getAllByRole('img');
      const img = images[0];
      expect(img).toHaveAttribute('loading', 'lazy');
    });
  });

  it('shows error state when image fails to load', async () => {
    // Mock Image to trigger error
    const mockImage = jest.fn(() => ({
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'error') {
          setTimeout(handler, 10);
        }
      }),
      removeEventListener: jest.fn(),
      src: ''
    }));
    global.Image = mockImage as unknown as jest.MockedClass<typeof Image>;

    const { getAllByRole } = renderComponent();

    await waitFor(() => {
      const alerts = getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  it('uses fallback source on error', async () => {
    const fallbackSrc = 'https://example.com/fallback.jpg';

    // Mock Image to trigger error on main image, then success on fallback
    const mockImage = jest.fn(() => ({
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'error') {
          setTimeout(handler, 10);
        }
      }),
      removeEventListener: jest.fn(),
      src: ''
    }));
    global.Image = mockImage as unknown as jest.MockedClass<typeof Image>;

    const { getAllByRole } = renderComponent({ fallbackSrc });

    await waitFor(() => {
      const images = getAllByRole('img');
      const img = images[0];
      expect(img).toHaveAttribute('src', fallbackSrc);
    });
  });

  it('maintains aspect ratio when specified', () => {
    const { container } = renderComponent({ aspectRatio: 16 / 9 });
    // Find the Box element with the container style (it has position: relative)
    const wrapper = container.querySelector('[style*="position: relative"]') as HTMLElement;

    expect(wrapper).toHaveStyle({
      paddingBottom: `${9 / 16 * 100}%`,
      height: '0px'
    });
  });

  it('uses custom loading component', () => {
    const CustomLoader = <div>Custom Loading...</div>;
    const { getAllByText } = renderComponent({
      loadingComponent: CustomLoader
    });

    const elements = getAllByText('Custom Loading...');
    expect(elements.length).toBeGreaterThan(0);
  });

  it('uses custom error component', async () => {
    const CustomError = <div>Custom Error</div>;

    // Mock Image to trigger error
    (global.Image as unknown as jest.MockedClass<typeof Image>) = jest.fn(() => ({
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'error') {
          setTimeout(handler, 10);
        }
      }),
      removeEventListener: jest.fn(),
      src: ''
    })) as unknown as jest.MockedClass<typeof Image>;

    const { getAllByText } = renderComponent({
      errorComponent: CustomError
    });

    await waitFor(() => {
      const elements = getAllByText('Custom Error');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('calls onLoad when image loads successfully', async () => {
    const onLoad = jest.fn();
    renderComponent({ onLoad });

    await waitFor(() => {
      expect(onLoad).toHaveBeenCalled();
    });
  });

  it('calls onError when image fails to load', async () => {
    const onError = jest.fn();

    // Mock Image to trigger error
    (global.Image as unknown as jest.MockedClass<typeof Image>) = jest.fn(() => ({
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === 'error') {
          setTimeout(handler, 10);
        }
      }),
      removeEventListener: jest.fn(),
      src: ''
    })) as unknown as jest.MockedClass<typeof Image>;

    renderComponent({ onError });

    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });

  it('applies responsive image attributes', async () => {
    const srcSet = 'image-320.jpg 320w, image-640.jpg 640w';
    const sizes = '(max-width: 600px) 100vw, 50vw';

    const { getAllByRole } = renderComponent({
      srcSet,
      sizes
    });

    await waitFor(() => {
      const images = getAllByRole('img');
      const img = images[0];
      // Use getAttribute() instead of toHaveAttribute for Bun compatibility
      expect(img?.getAttribute('srcset')).toBe(srcSet);
      expect(img?.getAttribute('sizes')).toBe(sizes);
    });
  });

  it('does not lazy load when lazy is false', async () => {
    mockUseIntersection.mockReturnValue({
      ref: { current: null },
      entry: null
    });

    const { getAllByRole } = renderComponent({ lazy: false });

    // Should load immediately regardless of intersection
    await waitFor(() => {
      const images = getAllByRole('img');
      const img = images[0];
      expect(img).toHaveAttribute('src', defaultProps.src);
    });
  });
});

describe('ProgressiveImage utilities', () => {
  describe('preloadImage', () => {
    it('resolves when image loads successfully', async () => {
      (global.Image as unknown as jest.MockedClass<typeof Image>) = jest.fn(() => ({
        addEventListener: jest.fn((event: string, handler: () => void) => {
          if (event === 'load') {
            setTimeout(handler, 10);
          }
        }),
        removeEventListener: jest.fn(),
        src: '',
        srcset: ''
      })) as unknown as jest.MockedClass<typeof Image>;

      await expect(preloadImage('test.jpg')).resolves.toBeUndefined();
    });

    it('rejects when image fails to load', async () => {
      (global.Image as unknown as jest.MockedClass<typeof Image>) = jest.fn(() => ({
        addEventListener: jest.fn((event: string, handler: () => void) => {
          if (event === 'error') {
            setTimeout(handler, 10);
          }
        }),
        removeEventListener: jest.fn(),
        src: ''
      })) as unknown as jest.MockedClass<typeof Image>;

      await expect(preloadImage('test.jpg')).rejects.toThrow();
    });
  });

  describe('generateSrcSet', () => {
    it('generates srcset string from widths', () => {
      const srcSet = generateSrcSet('image.jpg', [100, 200, 300]);
      expect(srcSet).toBe('image.jpg?w=100 100w, image.jpg?w=200 200w, image.jpg?w=300 300w');
    });

    it('uses default widths when none provided', () => {
      const srcSet = generateSrcSet('image.jpg');
      expect(srcSet).toContain('320w');
      expect(srcSet).toContain('1920w');
    });
  });
});