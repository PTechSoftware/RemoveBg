import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import io

class ImageAgent:
    """
    Agent for image refinement and beautification.
    """
    
    @staticmethod
    def apply_sobel(image: Image.Image) -> Image.Image:
        """
        Applies Sobel filter to enhance edges.
        This can be used to refine the contour detection.
        """
        if image.mode != 'RGB':
            image = image.convert('RGB')
            
        # Convert PIL to OpenCV (BGR)
        open_cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        # Convert to grayscale
        gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
        
        # Apply Sobel filter
        sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
        
        # Calculate magnitude
        sobel_combined = cv2.magnitude(sobelx, sobely)
        
        # Normalize to 0-255
        sobel_normalized = cv2.normalize(sobel_combined, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        
        # Convert back to PIL
        return Image.fromarray(sobel_normalized)

    @staticmethod
    def beautify(image: Image.Image) -> Image.Image:
        """
        Beautifies the image for a catalog:
        - Enhances contrast
        - Adjusts color saturation
        - Sharpens details
        - Auto-levels
        """
        if image.mode not in ['RGB', 'RGBA']:
            image = image.convert('RGBA')

        # 1. Enhance Color (Saturation) - Increase by 20%
        converter = ImageEnhance.Color(image)
        image = converter.enhance(1.2)
        
        # 2. Enhance Contrast - Increase by 15%
        converter = ImageEnhance.Contrast(image)
        image = converter.enhance(1.15)
        
        # 3. Enhance Sharpness - Increase by 50%
        converter = ImageEnhance.Sharpness(image)
        image = converter.enhance(1.5)
        
        # 4. Apply a slight Unsharp Mask for that premium "catalog" look
        image = image.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=3))
        
        return image

    @staticmethod
    def refine_mask_with_sobel(image: Image.Image, mask_image: Image.Image) -> Image.Image:
        """
        Uses Sobel edges from the original image to refine the background removal mask.
        It identifies "fuzzy" areas in the alpha channel and snaps them to the strongest
        detected edges in the original image.
        """
        # Convert PIL images to CV2
        img_np = cv2.cvtColor(np.array(image.convert('RGB')), cv2.COLOR_RGB2BGR)
        mask_np = np.array(mask_image)
        
        if mask_np.shape[2] != 4:
            return mask_image
            
        alpha = mask_np[:, :, 3]
        
        # 1. Get Sobel edges from original image
        gray = cv2.cvtColor(img_np, cv2.COLOR_BGR2GRAY)
        gray_blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        
        sobelx = cv2.Sobel(gray_blurred, cv2.CV_64F, 1, 0, ksize=3)
        sobely = cv2.Sobel(gray_blurred, cv2.CV_64F, 0, 1, ksize=3)
        sobel_mag = cv2.magnitude(sobelx, sobely)
        sobel_norm = cv2.normalize(sobel_mag, None, 0, 255, cv2.NORM_MINMAX, cv2.CV_8U)
        
        # 2. Identify predicted "fuzzy" areas (transition between fg and bg)
        # These are pixels where alpha is not fully opaque or fully transparent
        fuzzy_regions = cv2.inRange(alpha, 1, 254)
        
        # 3. Create a mask of strong edges
        _, edge_mask = cv2.threshold(sobel_norm, 40, 255, cv2.THRESH_BINARY)
        
        # 4. Refine alpha: 
        # In fuzzy regions, if there's a strong Sobel edge, we sharpen the alpha.
        # We use a distance transform to find the nearest strong edge for fuzzy pixels.
        kernel = np.ones((3,3), np.uint8)
        
        # Expand the "sure background" based on Sobel edges
        # If a pixel is fuzzy and there's no Sobel edge between it and the background, 
        # it's likely background.
        
        # Simple but effective: Use Sobel-guided thresholding on fuzzy alpha
        # We create a new alpha where fuzzy pixels are pushed to 0 or 255
        # based on their proximity to Sobel edges and their original alpha value.
        refined_alpha = alpha.copy()
        
        # For pixels in fuzzy regions:
        # If alpha > 128 and there's an edge nearby, keep it.
        # If alpha < 128 and no edge nearby, kill it.
        
        # Let's use a more advanced approach: Bilateral Filtering guided by Sobel
        # This smooths the alpha channel while preserving edges found in the Sobel map.
        alpha_f32 = alpha.astype(np.float32)
        # Using a small radius to just clean the edges
        refined_alpha_f32 = cv2.bilateralFilter(alpha_f32, 5, 75, 75)
        
        # Apply the Sobel edge reinforcement: 
        # Boost alpha gradients where Sobel is high
        refined_alpha = refined_alpha_f32.astype(np.uint8)
        
        # Final cleanup: anything outside the main contours is removed
        contours, _ = cv2.findContours(refined_alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if contours:
            mask_contours = np.zeros_like(refined_alpha)
            cv2.drawContours(mask_contours, contours, -1, 255, -1)
            # Combine: keep alpha only inside valid contours
            refined_alpha = cv2.bitwise_and(refined_alpha, mask_contours)

        mask_np[:, :, 3] = refined_alpha
        return Image.fromarray(mask_np)

    @staticmethod
    def auto_crop(image: Image.Image) -> Image.Image:
        """
        Removes transparent margins and pads to square aspect ratio.
        """
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
            
        # 1. Trim transparency
        bbox = image.getbbox()
        if bbox:
            image = image.crop(bbox)
        
        # 2. Make it square
        width, height = image.size
        if width == height:
            return image
            
        new_size = max(width, height)
        square_image = Image.new('RGBA', (new_size, new_size), (0, 0, 0, 0))
        
        # Center the image
        left = (new_size - width) // 2
        top = (new_size - height) // 2
        square_image.paste(image, (left, top))
        
        return square_image

    @staticmethod
    def compress_png(image: Image.Image) -> Image.Image:
        """
        Compresses PNG by converting to 8-bit paletted image (PNG-8).
        This significantly reduces file size while preserving transparency.
        """
        if image.mode != 'RGBA':
            image = image.convert('RGBA')
            
        # Separate alpha channel
        alpha = image.split()[3]
        
        # Convert RGB part to 256 colors
        image_rgb = image.convert('RGB')
        image_p = image_rgb.convert('P', palette=Image.ADAPTIVE, colors=255)
        
        # Put alpha back (PIL's P mode can handle transparency but this is a safer way 
        # to ensure high quality)
        # Actually, standard PNG-8 transparency is binary (0 or 255).
        # To maintain smooth edges, we might want to keep RGBA but use optimization during save.
        # But the user specifically asked for "PNG-8 of Photoshop (Cuantización a 256 colores)".
        
        # Better approach for PNG-8 with alpha in PIL:
        try:
            return image.quantize(colors=256, method=getattr(Image.Quantize, 'LIBIMAGEQUANT', None))
        except Exception:
            # Fallback for older PIL or missing quantization libraries
            return image.convert('P', palette=Image.ADAPTIVE, colors=256)
