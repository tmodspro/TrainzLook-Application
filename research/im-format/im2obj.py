"""Spike: Trainz .im (JIRF/IDXM) -> OBJ+MTL, resolving *.texture -> *.texture.txt -> image."""
import struct, sys, os, shutil

src, outdir = sys.argv[1], sys.argv[2]
flipv = len(sys.argv) > 3 and sys.argv[3] == 'flipv'
os.makedirs(outdir, exist_ok=True)
d = open(src, 'rb').read()
assert d[:4] == b'JIRF' and d[8:12] == b'IDXM'
folder = os.path.dirname(src)

def chunks(s, e):
    o = s
    while o + 8 <= e:
        t = d[o:o+4].decode('latin1'); z = struct.unpack_from('<I', d, o+4)[0]
        yield t, o + 8, z; o += 8 + z

def pstr(o):
    n = struct.unpack_from('<I', d, o)[0]
    return d[o+4:o+4+n].split(b'\0')[0].decode('latin1'), o + 4 + n

def jpeg_size(path):
    b = open(path, 'rb').read(); i = 2
    while i < len(b):
        m = b[i+1]; ln = struct.unpack('>H', b[i+2:i+4])[0]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack('>HH', b[i+5:i+9]); return w, h
        i += 2 + ln

def resolve_texture(ref):
    base = ref.replace('\\', '/').split('/')[-1]              # strip absolute author path
    txt = os.path.join(folder, base + '.txt')
    if os.path.exists(txt):
        kv = {}
        for line in open(txt, encoding='latin1'):
            if '=' in line:
                k, v = line.split('=', 1); kv[k.strip().lower()] = v.strip()
        return kv.get('primary'), kv
    return None, {}

obj = open(os.path.join(outdir, 'model.obj'), 'w'); mtl = open(os.path.join(outdir, 'model.mtl'), 'w')
obj.write('mtllib model.mtl\n'); voff = 0
for t, b, s in chunks(12, len(d)):
    if t != 'CHNK':
        continue
    mat = None
    for t2, b2, s2 in chunks(b + 8, b + s):
        if t2 == 'MATL':
            name, o = pstr(b2 + 4)
            o += 16 * 4
            ntex = struct.unpack_from('<I', d, o)[0]; o += 4
            tex = []
            for _ in range(ntex):
                ref, o = pstr(o + 4); o += 4; tex.append(ref)  # skip slot id, then path, then amount
            img, kv = resolve_texture(tex[0]) if tex else (None, {})
            mat = name
            mtl.write('newmtl %s\nKd 1 1 1\n' % name)
            if img:
                shutil.copy(os.path.join(folder, img), os.path.join(outdir, img))
                mtl.write('map_Kd %s\n' % img)
                print('material %-18s -> %-12s -> %s %s %s' % (name, tex[0].replace('\\', '/').split('/')[-1], img, jpeg_size(os.path.join(folder, img)), kv))
        elif t2 == 'GEOM':
            ver, _, has_tan, rad, nv, nt, ni, _, _, namelen = struct.unpack_from('<IIIfIIIIII', d, b2)
            o = b2 + 40 + namelen
            verts = [struct.unpack_from('<5f', d, o + 20*i) for i in range(nv)]; o += nv * 20
            idx = struct.unpack_from('<%dH' % ni, d, o); o += ni * 2
            norms = [struct.unpack_from('<3f', d, o + 12*i) for i in range(nv)]
            obj.write('o %s\nusemtl %s\n' % (mat, mat))
            for x, y, z, u, v in verts:      # Trainz: Z-up, Y-forward -> OBJ Y-up
                obj.write('v %f %f %f\nvt %f %f\n' % (x, z, -y, u, 1 - v if flipv else v))
            for nx, ny, nz in norms:
                obj.write('vn %f %f %f\n' % (nx, nz, -ny))
            for i in range(0, ni, 3):
                a, b_, c = (voff + idx[i+k] + 1 for k in range(3))
                obj.write('f %d/%d/%d %d/%d/%d %d/%d/%d\n' % (a, a, a, b_, b_, b_, c, c, c))
            voff += nv
print('done', voff, 'verts')
