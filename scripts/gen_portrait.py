from PIL import Image
import os

W, H = 64, 64

P = {
    'bg':       (188, 176, 164, 255),
    'bg_d':     (175, 163, 152, 255),
    'skin_sh':  (139, 90, 60, 255),
    'skin_mid': (192, 135, 99, 255),
    'skin_lt':  (212, 154, 122, 255),
    'skin_hl':  (224, 173, 140, 255),
    'hair_dk':  (26, 14, 8, 255),
    'hair_md':  (58, 32, 14, 255),
    'glass':    (22, 22, 26, 255),
    'glass_hl': (240, 240, 245, 255),
    'beard':    (42, 24, 16, 255),
    'shirt':    (31, 77, 74, 255),
    'shirt_sh': (20, 52, 50, 255),
    'mouth':    (107, 58, 42, 255),
    'iris':     (90, 58, 31, 255),
    'pupil':    (10, 6, 6, 255),
    'eye_w':    (240, 232, 220, 255),
}

img = Image.new('RGBA', (W, H), P['bg'])
px = img.load()

def sp(x, y, c):
    if 0 <= x < W and 0 <= y < H:
        px[x, y] = c

def fr(x1, y1, x2, y2, c):
    for y in range(y1, y2 + 1):
        for x in range(x1, x2 + 1):
            sp(x, y, c)

head_rows = {
    12: (27, 36), 13: (25, 38), 14: (23, 40), 15: (21, 42),
    16: (20, 43), 17: (19, 44), 18: (18, 45), 19: (18, 45),
    20: (17, 46), 21: (17, 46), 22: (17, 46), 23: (17, 46),
    24: (17, 46), 25: (17, 46), 26: (17, 46), 27: (17, 46),
    28: (17, 46), 29: (17, 46), 30: (17, 46), 31: (17, 46),
    32: (17, 46), 33: (17, 46), 34: (18, 45), 35: (18, 45),
    36: (18, 45), 37: (19, 44), 38: (19, 44), 39: (20, 43),
    40: (21, 42), 41: (22, 41), 42: (23, 40), 43: (24, 39),
    44: (25, 38), 45: (26, 37), 46: (27, 36), 47: (28, 35),
    48: (29, 34),
}

def in_head(x, y):
    r = head_rows.get(y)
    return r is not None and r[0] <= x <= r[1]

# shirt + neck base
fr(0, 56, 63, 63, P['shirt'])
for y in range(49, 58):
    half = min(7, 7 - max(0, y - 54))
    fr(32 - half, y, 32 + half - 1, y, P['skin_mid'])
# shirt collar v-cut hint
fr(28, 56, 35, 56, P['skin_mid'])
fr(29, 57, 34, 57, P['skin_mid'])
fr(30, 58, 33, 58, P['skin_mid'])
# shirt shadow under chin
for x in range(20, 44):
    sp(x, 56, P['shirt_sh']) if not (28 <= x <= 35) else None

# head fill
for y, (xl, xr) in head_rows.items():
    fr(xl, y, xr, y, P['skin_mid'])

# ears
fr(16, 26, 16, 31, P['skin_mid'])
fr(47, 26, 47, 31, P['skin_mid'])
sp(15, 28, P['skin_mid']); sp(48, 28, P['skin_mid'])
sp(16, 28, P['skin_sh']); sp(47, 28, P['skin_sh'])
sp(16, 30, P['skin_sh']); sp(47, 30, P['skin_sh'])

# skin shading on jaw/sides
side_sh = [(17,30),(17,32),(17,34),(18,36),(19,38),(20,40),
           (46,30),(46,32),(46,34),(45,36),(44,38),(43,40)]
for x, y in side_sh:
    if in_head(x, y): sp(x, y, P['skin_sh'])

# cheek dither highlight
for x, y in [(22,33),(24,33),(23,34),(25,34),(22,35),(24,35),
             (39,33),(41,33),(38,34),(40,34),(39,35),(41,35)]:
    if in_head(x, y): sp(x, y, P['skin_lt'])

# nose bridge shadow + tip
fr(31, 28, 32, 35, P['skin_sh'])
sp(30, 35, P['skin_sh']); sp(33, 35, P['skin_sh'])
sp(30, 36, P['skin_sh']); sp(33, 36, P['skin_sh'])
sp(31, 36, P['skin_lt']); sp(32, 36, P['skin_lt'])

# hair mass
hair_rows = {
    3:  (30, 33),
    4:  (26, 37),
    5:  (23, 40),
    6:  (21, 42),
    7:  (19, 44),
    8:  (17, 46),
    9:  (16, 47),
    10: (15, 48),
    11: (14, 49),
    12: (14, 49),
    13: (13, 50),
    14: (13, 50),
    15: (13, 50),
    16: (13, 50),
    17: (13, 49),
    18: (13, 49),
    19: (13, 48),
    20: (13, 47),
    21: (14, 21),  # only side temple
    22: (14, 19),
}
for y, (xl, xr) in hair_rows.items():
    fr(xl, y, xr, y, P['hair_dk'])
# right side temple separately
fr(44, 21, 50, 21, P['hair_dk'])
fr(45, 22, 49, 22, P['hair_dk'])

# forehead reveal: clear small skin patch at center-top of forehead
forehead_skin = [(28,19),(29,19),(34,19),(35,19),
                 (30,20),(31,20),(32,20),(33,20),
                 (29,21),(34,21)]
# leave hair, don't carve - want full curly cover. skip carve.

# hair curls (silhouette bumps top)
curls = [(24,2),(28,2),(32,2),(36,2),(40,2),
         (22,3),(38,3),(42,3),(20,4),(44,4),
         (18,5),(46,5),(15,7),(49,7),
         (13,10),(51,10),(12,13),(51,13)]
for x, y in curls:
    sp(x, y, P['hair_dk']); sp(x+1, y, P['hair_dk'])
    sp(x, y+1, P['hair_dk'])

# hair mid-tone highlights (dithered)
hair_hl = [(20,7),(22,6),(26,5),(30,4),(34,4),(38,5),(42,6),(45,8),
           (18,10),(24,9),(32,7),(40,9),(48,11),
           (16,13),(28,11),(36,11),(50,14)]
for x, y in hair_hl:
    if px[x, y] == P['hair_dk']:
        sp(x, y, P['hair_md'])

# extra hair texture dither inside mass
for x, y in [(20,12),(28,13),(36,13),(44,12),(22,15),(42,15),
             (16,16),(48,16),(26,17),(38,17)]:
    if px[x, y] == P['hair_dk']:
        sp(x, y, P['hair_md'])

# eyebrows
fr(21, 23, 27, 23, P['hair_dk'])
fr(36, 23, 42, 23, P['hair_dk'])
fr(22, 24, 26, 24, P['hair_dk'])
fr(37, 24, 41, 24, P['hair_dk'])

# eyes
fr(22, 27, 27, 29, P['eye_w'])
fr(36, 27, 41, 29, P['eye_w'])
# iris
fr(24, 27, 26, 29, P['iris'])
fr(38, 27, 40, 29, P['iris'])
# pupil
fr(25, 28, 25, 29, P['pupil'])
fr(39, 28, 39, 29, P['pupil'])
# catch light
sp(24, 27, P['eye_w']); sp(38, 27, P['eye_w'])

# glasses frames
def glasses():
    # top
    fr(20, 26, 28, 26, P['glass'])
    fr(35, 26, 43, 26, P['glass'])
    # bottom
    fr(20, 30, 28, 30, P['glass'])
    fr(35, 30, 43, 30, P['glass'])
    # sides
    for y in range(26, 31):
        sp(20, y, P['glass']); sp(28, y, P['glass'])
        sp(35, y, P['glass']); sp(43, y, P['glass'])
    # bridge
    fr(29, 27, 34, 27, P['glass'])
    # temples to ears
    fr(15, 27, 19, 27, P['glass'])
    fr(44, 27, 47, 27, P['glass'])
glasses()
# lens highlight glints
sp(22, 27, P['glass_hl']); sp(23, 27, P['glass_hl'])
sp(36, 27, P['glass_hl']); sp(37, 27, P['glass_hl'])

# mustache
fr(26, 38, 37, 38, P['beard'])
fr(25, 39, 38, 39, P['beard'])
fr(26, 40, 37, 40, P['beard'])
# part under nose
sp(31, 39, P['skin_mid']); sp(32, 39, P['skin_mid'])

# mouth (neutral closed line)
fr(28, 42, 35, 42, P['mouth'])
sp(28, 42, P['beard']); sp(35, 42, P['beard'])

# beard / chin
beard_rows = {
    43: (24, 39), 44: (24, 39), 45: (25, 38),
    46: (26, 37), 47: (27, 36), 48: (29, 34),
}
for y, (xl, xr) in beard_rows.items():
    fr(xl, y, xr, y, P['beard'])
# side beard up jaw
for y in range(36, 44):
    if in_head(20, y): sp(20, y, P['beard'])
    if in_head(21, y): sp(21, y, P['beard'])
    if in_head(43, y): sp(43, y, P['beard'])
    if in_head(42, y): sp(42, y, P['beard'])
# beard dither edges (sparse)
for x, y in [(23,42),(40,42),(22,40),(41,40),(25,44),(38,44)]:
    if in_head(x, y): sp(x, y, P['beard'])
# clip beard outside head
for y in range(36, 50):
    for x in range(W):
        if px[x, y] == P['beard'] and not in_head(x, y):
            sp(x, y, P['bg'])

# bg dither (subtle corners + edges)
bg_d_pts = [(2,2),(4,4),(6,6),(2,8),(8,2),(60,2),(58,4),(56,6),
            (60,8),(54,2),(2,60),(4,58),(6,56),(60,60),(58,58),
            (2,40),(4,42),(60,40),(58,42),(2,20),(60,20)]
for x, y in bg_d_pts:
    if px[x, y] == P['bg']:
        sp(x, y, P['bg_d'])

out = 'public/sprites/portrait_64.png'
os.makedirs('public/sprites', exist_ok=True)
img.save(out)
print(f'saved {out}')
