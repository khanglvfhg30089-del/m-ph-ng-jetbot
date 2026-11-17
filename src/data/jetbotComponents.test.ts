import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JETBOT_COMPONENTS, resolveJetBotComponent } from './jetbotComponents';

test('resolveJetBotComponent: all active 3D mesh IDs and aliases resolve with real photos and functions', () => {
  const meshIds = [
    'wheels',
    'motorBoard',
    'board',
    'jetson',
    'jetsonNano',
    'ports',
    'lidar',
    'camera',
    'antennas',
    'stereoCamera',
    'stereo',
  ];

  for (const id of meshIds) {
    const info = resolveJetBotComponent(id);
    assert.ok(info, `Expected component metadata for ${id}`);
    assert.ok(info.nameVi.length > 0, `Expected Vietnamese name for ${id}`);
    assert.ok(info.description.length > 20, `Expected description for ${id}`);
    assert.ok(info.functions.length >= 3, `Expected core functions list for ${id}`);
    assert.ok(info.realPhotos && info.realPhotos.length >= 1, `Expected real photo(s) for ${id}`);
  }

  assert.equal(resolveJetBotComponent('chassis'), null);
  assert.equal(resolveJetBotComponent('caster'), null);
  assert.equal(resolveJetBotComponent('gripper'), null);
  assert.equal(resolveJetBotComponent('topDeck'), null);
  assert.equal(resolveJetBotComponent('nonexistent'), null);
  assert.equal(resolveJetBotComponent(null), null);
});

test('JETBOT_COMPONENTS: all 7 newly uploaded lab photos are wired cleanly and exist on disk', () => {
  const uploadedPhotos = [
    '/assets/aistudio/rada_36d71920.jpg',
    '/assets/aistudio/b_nh_xe_154d4004.jpg',
    '/assets/aistudio/c_ng_k_t_n_i_2_ce65c0d9.jpg',
    '/assets/aistudio/camera_2c331e75.jpg',
    '/assets/aistudio/c_ng_k_t_n_i_6d2f76a5.jpg',
    '/assets/aistudio/qu_t_t_n_nhi_t_797085ee.jpg',
    '/assets/aistudio/anten_b6257050.jpg',
  ];

  const referencedUrls = new Set(
    JETBOT_COMPONENTS.flatMap((c) => (c.realPhotos ?? []).map((p) => p.url))
  );

  for (const url of uploadedPhotos) {
    assert.ok(referencedUrls.has(url), `Missing photo reference for ${url}`);
    const diskPath = path.join(process.cwd(), 'public', url.replace(/^\//, ''));
    assert.ok(fs.existsSync(diskPath), `Photo file missing on disk at ${diskPath}`);
  }
});
