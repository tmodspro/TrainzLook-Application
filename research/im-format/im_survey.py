import struct, sys, os, collections
import numpy as np
root = sys.argv[1]; res = collections.Counter(); ex = []
def unitness(d, o, n):
    if o < 0 or o + n*12 > len(d): return 0
    a = np.frombuffer(d, '<f4', n*3, o).reshape(n, 3)
    with np.errstate(all='ignore'):
        return float(np.mean(np.abs(np.linalg.norm(a, axis=1) - 1) < 1e-3))
for dp, dn, fn in os.walk(root):
    for f in fn:
        if not f.lower().endswith('.im'): continue
        d = open(os.path.join(dp, f), 'rb').read()
        def walk(s, e):
            o = s
            while o + 8 <= e:
                t = d[o:o+4].decode('latin1'); z = struct.unpack_from('<I', d, o+4)[0]
                if t == 'CHNK': walk(o + 16, o + 8 + z)
                if t == 'GEOM':
                    b = o + 8
                    ver, a1, flag, rad, nv, nt, ni, nt2, z1, z2 = struct.unpack_from('<IIIfIIIIII', d, b)
                    base = 40 + nv*20 + ni*2 + nv*12 + nt*12 + (nv*12 if flag else 0)
                    r = z - base
                    # where does the extra (z1+z2) block sit? test: normals unit if extra placed before verts vs after idx
                    pre = b + 40 + (z1 + z2)
                    n_after_idx_pre = unitness(d, pre + nv*20 + ni*2, nv)
                    n_after_idx_post = unitness(d, b + 40 + nv*20 + ni*2, nv)
                    res[(flag, r == z1 + z2, 'pre' if n_after_idx_pre > 0.9 else ('post' if n_after_idx_post > 0.9 else '?'), z1 > 0, z2 > 0)] += 1
                    if r != z1 + z2 and len(ex) < 5: ex.append((f, flag, nv, nt, ni, z1, z2, r))
                o += 8 + z
        walk(12, len(d))
for k, v in res.most_common(): print(v, 'flag=%s residual==z1+z2:%s extraPos=%s z1>0:%s z2>0:%s' % k)
print(ex)
