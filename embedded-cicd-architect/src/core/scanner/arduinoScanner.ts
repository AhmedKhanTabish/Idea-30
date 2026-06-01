/**
 * =============================================================================
 * ARDUINO SCANNER — Detects Arduino IDE / arduino-cli projects
 * =============================================================================
 * 
 * DETECTION: Looks for .ino files in the project root.
 * PRIORITY (25): Lowest — last resort when no specific scanner matched.
 */

import * as fs from 'fs';
import * as path from 'path';
import { IProjectScanner, ProjectProfile, createEmptyProfile } from './types';

/** Map of #include headers to their likely platform. */
const INCLUDE_TO_PLATFORM: Record<string, { platform: string; board: string }> = {
  'ESP8266WiFi.h':      { platform: 'espressif8266', board: 'esp8266' },
  'ESP8266WebServer.h':  { platform: 'espressif8266', board: 'esp8266' },
  'esp_wifi.h':         { platform: 'espressif32', board: 'esp32dev' },
  'BLEDevice.h':        { platform: 'espressif32', board: 'esp32dev' },
  'esp_camera.h':       { platform: 'espressif32', board: 'esp32cam' },
  'BluetoothSerial.h':  { platform: 'espressif32', board: 'esp32dev' },
  'STM32.h':            { platform: 'ststm32', board: 'genericSTM32F103C8' },
  'stm32f1xx_hal.h':    { platform: 'ststm32', board: 'genericSTM32F103C8' },
  'stm32f4xx_hal.h':    { platform: 'ststm32', board: 'genericSTM32F446RE' },
  'pico/stdlib.h':      { platform: 'raspberrypi', board: 'pico' },
  'avr/io.h':           { platform: 'atmelavr', board: 'uno' },
};

export class ArduinoScanner implements IProjectScanner {
  readonly name = 'Arduino Scanner';
  readonly priority = 25;

  async canScan(folderPath: string): Promise<boolean> {
    try {
      const entries = await fs.promises.readdir(folderPath);
      return entries.some(entry => entry.endsWith('.ino'));
    } catch {
      return false;
    }
  }

  async scan(folderPath: string): Promise<ProjectProfile> {
    const profile = createEmptyProfile();
    profile.projectType = 'arduino';
    profile.buildSystem = 'arduino-cli';
    profile.framework = 'arduino';
    profile.environments = ['default'];

    const entries = await fs.promises.readdir(folderPath);
    const inoFiles = entries.filter(f => f.endsWith('.ino'));
    profile.sourceFiles = inoFiles;

    if (inoFiles.length > 0) {
      const mainIno = path.join(folderPath, inoFiles[0]);
      const content = await fs.promises.readFile(mainIno, 'utf-8');
      const platformInfo = this.detectPlatformFromIncludes(content);
      if (platformInfo) {
        profile.platform = platformInfo.platform;
        profile.board = platformInfo.board;
      }
      profile.libraries = this.extractLibraries(content);
    }

    // Check for arduino.json (VS Code Arduino config)
    try {
      const arduinoJsonPath = path.join(folderPath, '.vscode', 'arduino.json');
      const arduinoJson = JSON.parse(await fs.promises.readFile(arduinoJsonPath, 'utf-8'));
      if (arduinoJson.board) {
        const boardParts = arduinoJson.board.split(':');
        profile.board = boardParts[boardParts.length - 1] || profile.board;
        profile.extraConfig.fqbn = arduinoJson.board;
      }
    } catch { /* No arduino.json — fine */ }

    return profile;
  }

  /** Score each platform based on how many indicator headers appear in includes. */
  private detectPlatformFromIncludes(content: string): { platform: string; board: string } | null {
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    const scores: Record<string, { count: number; platform: string; board: string }> = {};
    let match;
    while ((match = includeRegex.exec(content)) !== null) {
      const headerName = path.basename(match[1]);
      const info = INCLUDE_TO_PLATFORM[headerName];
      if (info) {
        if (!scores[info.platform]) scores[info.platform] = { count: 0, ...info };
        scores[info.platform].count++;
      }
    }
    let best: { count: number; platform: string; board: string } | null = null;
    for (const score of Object.values(scores)) {
      if (!best || score.count > best.count) best = score;
    }
    return best;
  }

  /** Extract library names from #include statements, filtering out standard headers. */
  private extractLibraries(content: string): string[] {
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    const libs: string[] = [];
    const standardHeaders = new Set(['Arduino.h','Wire.h','SPI.h','EEPROM.h','Servo.h','string.h','stdlib.h','stdio.h','math.h']);
    let match;
    while ((match = includeRegex.exec(content)) !== null) {
      const header = path.basename(match[1]);
      if (!standardHeaders.has(header)) libs.push(header.replace(/\.h$/, ''));
    }
    return [...new Set(libs)];
  }
}
