import webpack from 'webpack';
import serve from 'webpack-serve';
import logger, { hmr } from '@sb/core-logger/node';
import stripAnsi from 'strip-ansi';
import * as rendererMessages from '@sb/core-messages/src/renderer';
import * as webpackMessages from '@sb/core-messages/src/webpack';

import { toStore } from './lib/util';

import entriesConfig from './webpack.entries.fn';
import vendorConfig from './webpack.vendor.fn';
import serveConfig from './serve.config';

export const configs = {
  entries: entriesConfig,
  vendor: vendorConfig,
  serve: serveConfig,
};

const vendor = {
  configure: vendorConfig,
  config: {},
  time: 0,
};
const entries = {
  configure: entriesConfig,
  config: {},
  time: 0,
};

const ignoredPackages = /(hot-update|\.html|\.map)/;

export const run = userConfig => {
  const { renderers, entryPattern } = userConfig;

  vendor.time = process.hrtime();
  vendor.config = vendor.configure(
    Object.assign({}, userConfig.webpack.vendor, { renderers, entryPattern })
  );

  webpackMessages.building(vendor);

  webpack(vendor.config).run(() => {
    vendor.time = process.hrtime(vendor.time);
    webpackMessages.built(vendor);

    entries.time = process.hrtime();
    entries.config = entries.configure(
      Object.assign({}, userConfig.webpack.entries, { renderers, entryPattern })
    );

    webpackMessages.building(entries);

    serve(Object.assign(configs.serve({}), { config: entries.config })).then(server => {
      entries.time = process.hrtime(entries.time);
      webpackMessages.built(entries);

      const { compiler } = server;

      server.on('listening', () => {
        logger.info('Server listening');
      });

      // compilation.hotUpdateChunkTemplate.hooks.modules.tap('me', (...args) => {
      //   logger.warn({ hotUpdateChunkTemplate: args });
      // });

      const state = {
        invalids: [],
      };

      compiler.hooks.invalid.tap('me', m => {
        state.invalids.push(m);
      });

      compiler.hooks.done.tap('me', ({ compilation }) => {
        try {
          hmr.info(
            `built: \n${compilation
              .getStats()
              .toString({
                all: false,
                assets: true,
                modules: true,
                chunks: false,
                cached: true,
                excludeAssets: assetname => assetname.match(ignoredPackages),

                errors: true,
                errorDetails: true,
                warnings: true,
                moduleTrace: true,
                colors: true,
              })
              .split('\n')
              .filter(
                m =>
                  !(m.includes('delegated') || m.includes('hot-client') || m.includes('multi')) &&
                  (m.includes('[built]') || m.includes('[emitted]'))
              )
              .sort((a, b) => {
                if (a.includes('[built]') && !b.includes('[built]')) {
                  return -1;
                }
                // if (a.includes('[built]') && a.includes('[built]')) {
                //  todo sort alphabetical
                // }
                return 1;
              })
              .map(m => {
                if (m.includes('renderers/')) {
                  const [, renderer] = m.match(/renderers.(.*?)\/.*(\{.*?\})/);
                  const files = m.match(/\{.*?\}/g);
                  rendererMessages.foundInAsset({
                    name: stripAnsi(renderer),
                    assets: files.map(f => stripAnsi(f).slice(1, -1)),
                  });
                }
                return m;
              })
              // .reduce(
              //   (acc, item) =>
              //     // I want to remove assets that did not have a chunk changed
              //     acc.find(i => i.includes('[built]') && i.includes('{button/button.example}'))
              // )
              .join('\n')}`
          );
        } catch (error) {
          logger.error(error);
        }

        state.invalids = [];

        try {
          const data = toStore(compilation);
          // logger.debug(data);
        } catch (err) {
          logger.error(err);
        }
      });
    });
  });
};