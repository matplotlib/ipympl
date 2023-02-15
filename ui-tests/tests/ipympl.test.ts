// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IJupyterLabPageFixture, test } from '@jupyterlab/galata';
import { expect } from '@playwright/test';
import * as path from 'path';
const klaw = require('klaw-sync');

async function sleep(time: number) {
    return await new Promise((resolve) => setTimeout(resolve, time));
}

const filterUpdateNotebooks = (item) => {
    const basename = path.basename(item.path);
    return basename.includes('_update');
};

const testCellOutputs = async (
    page: IJupyterLabPageFixture,
    tmpPath: string
) => {
    const paths = klaw(path.resolve(__dirname, './notebooks'), {
        filter: (item) => !filterUpdateNotebooks(item),
        nodir: true,
    });
    const notebooks = paths.map((item) => path.basename(item.path));

    for (const notebook of notebooks) {
        let results = [];

        await page.notebook.openByPath(`${tmpPath}/${notebook}`);
        await page.notebook.activate(notebook);

        let numCellImages = 0;

        const getCaptureImageName = (notebook: string, id: number): string => {
            return `${notebook}-cell-${id}.png`;
        };

        await page.notebook.runCellByCell({
            onAfterCellRun: async (cellIndex: number) => {
                const cell = await page.notebook.getCellOutput(cellIndex);
                if (cell) {
                    await sleep(500);
                    results.push(await cell.screenshot());
                    numCellImages++;
                }
            },
        });

        await page.notebook.save();

        for (let c = 0; c < numCellImages; ++c) {
            expect(results[c]).toMatchSnapshot(
                getCaptureImageName(notebook, c),
                { threshold: 0.4 }
            );
        }

        await page.notebook.close(true);
    }
};

const testUpdates = async (page: IJupyterLabPageFixture, tmpPath: string) => {
    const paths = klaw(path.resolve(__dirname, './notebooks'), {
        filter: (item) => filterUpdateNotebooks(item),
        nodir: true,
    });
    const notebooks = paths.map((item) => path.basename(item.path));

    for (const notebook of notebooks) {
        let results = [];

        await page.notebook.openByPath(`${tmpPath}/${notebook}`);
        await page.notebook.activate(notebook);

        const getCaptureImageName = (notebook: string, id: number): string => {
            return `${notebook}-cell-${id}.png`;
        };

        let cellCount = 0;
        await page.notebook.runCellByCell({
            onAfterCellRun: async (cellIndex: number) => {
                // Always get first cell output which must contain the plot
                const cell = await page.notebook.getCellOutput(0);
                if (cell) {
                    await sleep(500);
                    results.push(await cell.screenshot());
                    cellCount++;
                }
            },
        });

        await page.notebook.save();

        for (let i = 0; i < cellCount; i++) {
            expect(results[i]).toMatchSnapshot(
                getCaptureImageName(notebook, i),
                { threshold: 0.4 }
            );
        }

        await page.notebook.close(true);
    }
};

test.describe('ipympl Visual Regression', () => {
    test.beforeEach(async ({ page, tmpPath }) => {
        await page.contents.uploadDirectory(
            path.resolve(__dirname, './notebooks'),
            tmpPath
        );
        await page.filebrowser.openDirectory(tmpPath);
    });

    test('Check ipympl first renders', async ({ page, tmpPath }) => {
        await testCellOutputs(page, tmpPath);
    });

    test('Check ipympl update', async ({ page, tmpPath }) => {
        await testUpdates(page, tmpPath);
    });
});
