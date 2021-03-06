import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { document, WebSocket } from 'global';

import { StorybookContext } from '@sb/ui-registry';

class App extends Component {
  state = {
    examples: [],
  };
  componentDidMount() {
    this.socket = new WebSocket('ws://localhost:8082');

    this.socket.addEventListener('open', () => {
      this.socket.send(
        JSON.stringify({
          type: 'broadcast',
          data: {
            type: 'pull',
          },
        })
      );
    });

    this.socket.addEventListener('message', ({ data }) => {
      if (data && data.substr('push')) {
        const result = JSON.parse(data);
        if (result.type === 'push') {
          this.setState({
            examples: Object.entries(result.data),
          });
        }
      }
    });
  }

  renderMain({ AppLayout, Preview }) {
    const { examples } = this.state;

    return (
      <div
        style={{
          height: '100%',
          width: '100%',
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *, *:before, *:after {
                font-family: -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", "Lucida Grande", Arial, sans-serif;
              }
            `,
          }}
        />
        <AppLayout examples={examples}>
          {({ selected }) => (
            <div
              style={{
                height: '100%',
                width: '100%',
                display: 'flex',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  border: '0 none',
                  margin: 10,
                  boxShadow: '1px 1px 5px rgba(0,0,0,0.3)',
                  padding: 0,
                  flex: 1,
                  width: 'auto',
                }}
              >
                <Preview url={`http://localhost:1337/${selected}.html`} />
              </div>
            </div>
          )}
        </AppLayout>
      </div>
    );
  }

  render() {
    return (
      <StorybookContext.Consumer>{registry => this.renderMain(registry)}</StorybookContext.Consumer>
    );
  }
}

ReactDOM.render(<App />, document.getElementById('root'));
