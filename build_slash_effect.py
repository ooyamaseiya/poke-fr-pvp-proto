import os
import math
import numpy as np
from PIL import Image, ImageDraw

FRAME_SIZE = 64
FRAMES = 5
SHEET_WIDTH = FRAME_SIZE * FRAMES
SHEET_HEIGHT = FRAME_SIZE
OUTPUT_DIR = "./output/assets/effects"

COLOR_TRANS  = (0, 0, 0, 0)        # Transparent: (0, 0, 0, 0)
COLOR_WHITE  = (255, 255, 255, 255)# #FFFFFF
COLOR_GRAY   = (168, 168, 168, 255)# #A8A8A8
COLOR_BLACK  = (16, 16, 16, 255)    # #101010

def get_distance_and_t(p, p1, p2):
    x0, y0 = p
    x1, y1 = p1
    x2, y2 = p2
    dx = x2 - x1
    dy = y2 - y1
    L2 = dx*dx + dy*dy
    if L2 == 0: return math.sqrt((x0-x1)**2 + (y0-y1)**2), 0.0
    t = ((x0 - x1) * dx + (y0 - y1) * dy) / L2
    t_clamped = max(0, min(1, t))
    proj_x = x1 + t_clamped * dx
    proj_y = y1 + t_clamped * dy
    dist = math.sqrt((x0 - proj_x)**2 + (y0 - proj_y)**2)
    return dist, t

def generate_slash_sheet():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    frames_arr = []

    for f in range(FRAMES):
        arr = np.zeros((FRAME_SIZE, FRAME_SIZE, 4), dtype=np.uint8)
        if f == 0: # Frame 1 (Slash start)
            p1, p2 = (54, 10), (32, 32)
            for py in range(FRAME_SIZE):
                for px in range(FRAME_SIZE):
                    dist, t = get_distance_and_t((px, py), p1, p2)
                    if 0 <= t <= 1:
                        if dist < 0.7: arr[py, px] = list(COLOR_WHITE)
                        elif dist < 1.5: arr[py, px] = list(COLOR_BLACK)
        elif f == 1: # Frame 2 (Slash through - Main strike)
            p1, p2 = (58, 6), (6, 58)
            for py in range(FRAME_SIZE):
                for px in range(FRAME_SIZE):
                    dist, t = get_distance_and_t((px, py), p1, p2)
                    if 0 <= t <= 1:
                        R_white = 3.5 * math.sin(math.pi * max(0, min(1, t))) if (0 < t < 1) else 0.2
                        if dist <= R_white: arr[py, px] = list(COLOR_WHITE)
                        elif dist <= R_white + 1.5: arr[py, px] = list(COLOR_GRAY)
                        else: arr[py, px] = list(COLOR_BLACK)
        elif f == 2: # Frame 3 (Max Impact - Sparks included)
            p1, p2 = (58, 6), (6, 58)
            for py in range(FRAME_SIZE):
                for px in range(FRAME_SIZE):
                    dist, t = get_distance_and_t((px, py), p1, p2)
                    if 0 <= t <= 1:
                        R_white = 2.5 * math.sin(math.pi * max(0, min(1, t))) if (0 < t < 1) else 0.2
                        if dist <= R_white: arr[py, px] = list(COLOR_WHITE)
                        elif dist <= R_white + 1.5: arr[py, px] = list(COLOR_GRAY)
                        else: arr[py, px] = list(COLOR_BLACK)
            np.random.seed(42) 
            for _ in range(10):
                sx, sy = np.random.randint(5, 60), np.random.randint(5, 60)
                dist_to_line, t_val = get_distance_and_t((sx, sy), p1, p2)
                if 0 < dist_to_line < 15 and 0.3 < t_val < 0.7:
                    arr[sy, sx] = list(COLOR_WHITE)
                    if sy+1 < FRAME_SIZE: arr[sy+1, sx] = list(COLOR_GRAY)
        elif f == 3: # Frame 4 (Decay - Dashed line)
            p1, p2 = (58, 6), (6, 58)
            for py in range(FRAME_SIZE):
                for px in range(FRAME_SIZE):
                    dist, t = get_distance_and_t((px, py), p1, p2)
                    if 0 <= t <= 1:
                        if (int(t * 8) % 2 == 0):
                            R_thin = 1.5 * math.sin(math.pi * max(0, min(1, t))) if (0 < t < 1) else 0.2
                            if dist <= R_thin + 0.5: arr[py, px] = list(COLOR_GRAY)
                            else: arr[py, px] = list(COLOR_BLACK)
        elif f == 4: # Frame 5 (Afterglow - Tiny dots only)
            np.random.seed(7)
            for _ in range(8):
                sx, sy = np.random.randint(10, 55), np.random.randint(10, 55)
                arr[sy, sx] = list(COLOR_WHITE)
                if sy+1 < FRAME_SIZE: arr[sy+1, sx] = list(COLOR_GRAY)

        frames_arr.append(arr)

    sheet = np.zeros((SHEET_HEIGHT, SHEET_WIDTH, 4), dtype=np.uint8)
    for i, frame in enumerate(frames_arr):
        sheet[0:FRAME_SIZE, i*FRAME_SIZE:(i+1)*FRAME_SIZE] = frame

    img_sheet = Image.fromarray(sheet, "RGBA")
    png_path = os.path.join(OUTPUT_DIR, "slash_sheet.png")
    img_sheet.save(png_path)

    gif_frames = []
    bg_color = (40, 40, 40, 255) # #282828
    for i in range(len(frames_arr)):
        f_img = Image.fromarray(frames_arr[i], "RGBA").resize((FRAME_SIZE * 4, FRAME_SIZE * 4), resample=Image.NEAREST)
        bg = Image.new("RGBA", (FRAME_SIZE * 4, FRAME_SIZE * 4), bg_color)
        combined = bg.copy()
        combined.paste(f_img, (0, 0), f_img)
        gif_frames.append(combined)

    for _ in range(4): gif_frames.append(gif_frames[-1])
    gif_path = os.path.join(OUTPUT_DIR, "slash_preview.gif")
    gif_frames[0].save(gif_path, save_all=True, append_images=gif_frames[1:], duration=70, loop=0)

    return png_path, gif_path

def validate():
    png_path = os.path.join(OUTPUT_DIR, "slash_sheet.png")
    if not os.path.exists(png_path): return False
    img = Image.open(png_path)
    w, h = img.size
    if w != 320 or h != 64: return False
    arr = np.array(img)
    alpha = arr[:, :, 3]
    if not (np.all((alpha == 0) | (alpha == 255))): return False
    print("Validation Success!")
    return True

if __name__ == "__main__":
    png, gif = generate_slash_sheet()
    if validate():
        print("Done.")
