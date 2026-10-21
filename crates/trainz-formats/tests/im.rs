use std::path::Path;
use trainz_formats::{parse_im, parse_texture_txt, texture_txt_path};

fn u32s(out: &mut Vec<u8>, vals: &[u32]) {
    vals.iter().for_each(|v| out.extend(v.to_le_bytes()));
}

fn f32s(out: &mut Vec<u8>, vals: &[f32]) {
    vals.iter().for_each(|v| out.extend(v.to_le_bytes()));
}

fn chunk(tag: &[u8; 4], payload: Vec<u8>) -> Vec<u8> {
    let mut out = tag.to_vec();
    u32s(&mut out, &[payload.len() as u32]);
    out.extend(payload);
    out
}

fn padded(s: &str, len: usize) -> Vec<u8> {
    let mut b = s.as_bytes().to_vec();
    b.resize(len, 0);
    b
}

/// One-triangle mesh in the layout seen in real files; `indices` lets tests inject bad data.
fn sample_im(bone: &str, tangents: bool, indices: [u16; 3]) -> Vec<u8> {
    let mut info = Vec::new();
    u32s(&mut info, &[104]);
    info.extend([0u8; 0x28]);
    f32s(&mut info, &[-1.0, -2.0, 0.0, 1.0, 2.0, 3.0]);

    let mut matl = Vec::new();
    u32s(&mut matl, &[103, 12]);
    matl.extend(padded("1.m.onetex", 12));
    matl.extend([0u8; 16 * 4]);
    let tex = r"E:\Games\Trainz\editing\New folder\mc.texture";
    u32s(&mut matl, &[1, 1, 48]); // count, slot, path length
    matl.extend(padded(tex, 48));
    f32s(&mut matl, &[1.0]);

    let mut geom = Vec::new();
    u32s(&mut geom, &[201, 4, tangents as u32]);
    f32s(&mut geom, &[1.5]);
    u32s(&mut geom, &[3, 1, 3, 1, 0, bone.len() as u32]);
    geom.extend(bone.as_bytes());
    f32s(
        &mut geom,
        &[0., 0., 0., 0., 0., 1., 0., 0., 1., 0., 0., 1., 0., 0., 1.],
    );
    indices.iter().for_each(|i| geom.extend(i.to_le_bytes()));
    f32s(&mut geom, &[0., 0., 1., 0., 0., 1., 0., 0., 1.]); // vertex normals
    f32s(&mut geom, &[0., 0., 1.]); // face normal
    if tangents {
        f32s(&mut geom, &[1., 0., 0., 1., 0., 0., 1., 0., 0.]);
    }

    let mut chnk = Vec::new();
    u32s(&mut chnk, &[100, 0]);
    chnk.extend(chunk(b"MATL", matl));
    chnk.extend(chunk(b"GEOM", geom.clone()));

    // m.notex has no texture entries after the count.
    let mut notex = Vec::new();
    u32s(&mut notex, &[103, 12]);
    notex.extend(padded("grey.m.notex", 12));
    notex.extend([0u8; 16 * 4]);
    u32s(&mut notex, &[0]);
    let mut chnk2 = Vec::new();
    u32s(&mut chnk2, &[100, 1]);
    chnk2.extend(chunk(b"MATL", notex));
    chnk2.extend(chunk(b"GEOM", geom));

    let mut atch = Vec::new();
    u32s(&mut atch, &[100, 1, 6]);
    atch.extend(padded("a.bog0", 6));
    f32s(
        &mut atch,
        &[1., 0., 0., 0., 1., 0., 0., 0., 1., 0., -6.8, 0.],
    );

    let mut body = b"IDXM".to_vec();
    body.extend(chunk(b"INFO", info));
    body.extend(chunk(b"CHNK", chnk));
    body.extend(chunk(b"CHNK", chnk2));
    body.extend(chunk(b"INFL", vec![100, 0, 0, 0, 0, 0, 0, 0]));
    body.extend(chunk(b"ATCH", atch));
    let mut file = b"JIRF".to_vec();
    u32s(&mut file, &[body.len() as u32]);
    file.extend(body);
    file
}

#[test]
fn parses_all_geom_variants() {
    for (bone, tangents) in [("", true), ("", false), ("b.r.body1", true)] {
        let mesh = parse_im(&sample_im(bone, tangents, [0, 1, 2])).unwrap();
        assert_eq!(mesh.bbox, [[-1.0, -2.0, 0.0], [1.0, 2.0, 3.0]]);
        let p = &mesh.parts[0];
        assert_eq!(p.material, "1.m.onetex");
        assert_eq!(p.bone.as_deref(), (!bone.is_empty()).then_some(bone));
        assert_eq!(p.positions, [0., 0., 0., 1., 0., 0., 0., 1., 0.]);
        assert_eq!(p.uvs, [0., 0., 1., 0., 0., 1.]);
        assert_eq!(p.indices, [0, 1, 2]);
        assert_eq!(p.normals.len(), 9);
        assert_eq!(p.textures.len(), 1);
        assert!(mesh.parts[1].textures.is_empty());
        assert_eq!(mesh.attachments[0].name, "a.bog0");
        assert_eq!(mesh.attachments[0].matrix[10], -6.8);
    }
}

#[test]
fn rejects_truncated_and_corrupt_files_without_panicking() {
    let good = sample_im("b.r.body1", true, [0, 1, 2]);
    for len in 0..good.len() {
        assert!(
            parse_im(&good[..len]).is_err(),
            "prefix of {len} bytes parsed"
        );
    }
    let err = parse_im(&sample_im("", true, [0, 1, 7])).unwrap_err();
    assert!(err.msg.contains("out of range"), "{err}");
}

#[test]
fn resolves_texture_by_file_name_beside_mesh() {
    let mesh = parse_im(&sample_im("", true, [0, 1, 2])).unwrap();
    let txt = texture_txt_path(Path::new("body"), &mesh.parts[0].textures[0]);
    assert_eq!(txt, Path::new("body").join("mc.texture.txt"));

    let kv = parse_texture_txt("\u{feff}Primary=mc.jpg\r\nAlpha = mc_a.tga\nTile=st\n");
    assert_eq!(kv["primary"], "mc.jpg");
    assert_eq!(kv["alpha"], "mc_a.tga");
    assert_eq!(kv["tile"], "st");
}

use trainz_formats::ImFile;

/// Column-major 4x4, like three.js Matrix4.elements.
fn matrix(scale: [f32; 3], translate: [f32; 3]) -> [f32; 16] {
    let mut m = [0.0; 16];
    m[0] = scale[0];
    m[5] = scale[1];
    m[10] = scale[2];
    m[12..15].copy_from_slice(&translate);
    m[15] = 1.0;
    m
}

#[test]
fn rewrites_untouched_files_byte_for_byte() {
    for (bone, tangents) in [("", true), ("", false), ("b.r.body1", true)] {
        let data = sample_im(bone, tangents, [0, 1, 2]);
        assert_eq!(ImFile::parse(&data).unwrap().to_bytes(), data);
    }
}

#[test]
fn transform_moves_points_but_only_turns_normals() {
    let mut im = ImFile::parse(&sample_im("", true, [0, 1, 2])).unwrap();
    let part = im.parts_mut().next().unwrap();
    part.transform(&matrix([2.0, 2.0, 2.0], [10.0, 0.0, 5.0]))
        .unwrap();
    assert_eq!(part.verts[1][..3], [12.0, 0.0, 5.0]);
    assert_eq!(part.verts[1][3..], [1.0, 0.0], "UVs never change");
    assert_eq!(
        part.normals[0],
        [0.0, 0.0, 1.0],
        "normals ignore translation and uniform scale"
    );
    assert_eq!(
        part.stored_area(),
        2.0,
        "a 0.5 m² triangle scaled 2x is 2 m²"
    );
    assert_eq!(part.indices, [0, 1, 2]);
}

#[test]
fn mirroring_flips_winding_so_faces_stay_outward() {
    let mut im = ImFile::parse(&sample_im("", true, [0, 1, 2])).unwrap();
    let part = im.parts_mut().next().unwrap();
    part.transform(&matrix([-1.0, 1.0, 1.0], [0.0; 3])).unwrap();
    assert_eq!(part.indices, [0, 2, 1]);
    // The rewound triangle's geometric normal must agree with the stored normal (+Z after a mirror in X).
    let p = |i: u16| part.verts[i as usize];
    let (a, b, c) = (p(part.indices[0]), p(part.indices[1]), p(part.indices[2]));
    let z = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    assert!(z > 0.0 && part.normals[0] == [0.0, 0.0, 1.0]);
}

#[test]
fn rejects_a_collapsing_transform() {
    let mut im = ImFile::parse(&sample_im("", true, [0, 1, 2])).unwrap();
    assert!(
        im.parts_mut()
            .next()
            .unwrap()
            .transform(&matrix([1.0, 0.0, 1.0], [0.0; 3]))
            .is_err()
    );
}

#[test]
fn appended_parts_are_numbered_on_and_counted_in_info() {
    let mut base = ImFile::parse(&sample_im("", true, [0, 1, 2])).unwrap();
    let extra = ImFile::parse(&sample_im("", false, [0, 1, 2])).unwrap();
    let mut parts: Vec<_> = extra.parts().cloned().collect();
    parts
        .iter_mut()
        .for_each(|p| p.transform(&matrix([1.0; 3], [0.0, 50.0, 0.0])).unwrap());
    base.append_parts(parts).unwrap();

    let bytes = base.to_bytes();
    let reread = ImFile::parse(&bytes).unwrap();
    assert_eq!(
        reread.parts().map(|p| p.index).collect::<Vec<_>>(),
        [0, 1, 2, 3]
    );
    let info = bytes.windows(4).position(|w| w == b"INFO").unwrap() + 8;
    assert_eq!(
        &bytes[info + 0x20..info + 0x24],
        &4u32.to_le_bytes(),
        "INFO chunk count"
    );
    let mesh = parse_im(&bytes).unwrap();
    assert_eq!(mesh.parts.len(), 4);
    assert_eq!(
        mesh.bbox,
        [[-1.0, -2.0, 0.0], [1.0, 51.0, 3.0]],
        "bbox grows to cover the moved parts"
    );
    assert_eq!(
        mesh.attachments[0].name, "a.bog0",
        "chunks after the parts (ATCH) are kept"
    );
}
