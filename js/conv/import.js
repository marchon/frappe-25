import ModelFactory from '../main/modelfactory';

let instance = null;

export default class Import {
  constructor() {
    if(instance) return instance;
    instance = this;
  }

  start(body, rel) {
    const { '!left': left = 0, '!top': top = 0, '@to': next } = body,
          ret = ModelFactory.create('start', top, left);

    rel.push([ 'start', next ]);

    return ret;
  }
  end(body) {
    const { '!left': left = 0, '!top': top = 0, '@name': name = 'end' } = body,
          ret = ModelFactory.create('end', top, left);

    ret.props = { name: name };

    return ret;
  }
  kill(body) {
    const { '!left': left = 0, '!top': top = 0, '@name': name, message: { '#text': message } } = body,
          ret = ModelFactory.create('kill', top, left);

    ret.props = { name: name, general: { config: { message: message } } };

    return ret;
  }
  decision(body, rel) {
    const {
            '!left': left = 0, '!top': top = 0, '@name': name,
            'switch': { 'case': node = [], 'default': defNode = '' }
          } = body,
          ret = ModelFactory.create('decision', top, left);

    ret.name = name;
    node.concat(defNode).forEach(o => rel.push([ name, o['@to'] ]));
    return ret;
  }
  fork(body, rel) {
    const { '!left': left = 0, '!top': top = 0, '@name': name, 'path': path = [] } = body,
          ret = ModelFactory.create('fork', top, left);

    ret.name = name;
    path.forEach(o => rel.push([ name, o['@start'] ]));

    return ret;
  }
  join(body, rel) {
    const { '!left': left = 0, '!top': top = 0, '@name': name, '@to': next } = body,
          ret = ModelFactory.create('join', top, left);

    ret.name = name;
    rel.push([ name, next ]);

    return ret;
  }

  action(body, rel) {
    const {
            '!left': left = 0, '!top': top = 0, '@name': name,
            'ok': okNode = {}, 'error': errNode = {}
          } = body,
          { '@to': okTo } = okNode,
          { '@to': errTo } = errNode,
          tagName = Object.keys(body).filter(k => [ '@', '#', '!' ].indexOf(k[0]) == -1 && [ 'ok', 'error' ].indexOf(k) == -1)[0],
          ret = ModelFactory.create(tagName, top, left);

    this[`_${tagName}`](ret, body[tagName]);

    ret.name = name;
    rel.push([ name, okTo ]);
    rel.push([ name, errTo ]);

    return ret;
  }

  ['_map-reduce'](model, tagBody) {
    model.props = {
      'general': {
    
      },
      'advanced': {}
    };
    let targetMap = {
      'configuration': 'general.configuration'
    };
    [ 'configuration', 'prepare', 'file', 'archive' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });
  }
  _pig(model, tagBody) {    
    model.props = {
      'general': {},
      'advanced': {}
    };

    [ 'script' ].forEach(k => {
      this._addProp(model.props, k, this._getText(tagBody[k]), { 'script': 'general.config.script' });
    });  


    [ 'prepare', 'configuration', 'param', 'argument', 'file', 'archive' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]));
    });  
  }
  _fs(model, tagBody) {
    // 기본 properties 구조 선언
    model.props = { 'general': {} };

    // 공통 컨버트 메소드 사용
    let targetMap = {
      'configuration': 'general.configuration'
    };
    [ 'configuration' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });

    // fs 전용 컨버트
    let commandArr = [];
    // convert 함수
    let convertCmdValue = function(cmd, oldValue) {
      let newValue = { key: cmd, values: {} };

      switch(cmd) {
        case 'mkdir':
        case 'touchz':
        case 'delete':
        case 'move':
          Object.keys(oldValue).forEach(k => newValue.values[k.replace('@', '')] = oldValue[k]);
          break;
        case 'chmod':
          Object.keys(oldValue).forEach(k => {
            let valueKey = k.replace('@', '');
            // permissions 처리
            if(valueKey == 'permissions') {
              const targets = [ 'owner', 'group', 'others' ],
                    actions = [ 'execute', 'write', 'read' ];
              
              oldValue[k].split('').forEach((u, i) => {
                const bin = (u|0).toString(2).split('');
                new Array(3 - bin.length).fill('0').concat(bin).forEach((p, j) => {
                  const permValue = (p|0)*Math.pow(2, j);
                  permValue != 0 && (newValue.values[`${valueKey}.${targets[i]}.${actions[j]}`] = permValue);
                });
              });
            } else {
              newValue.values[valueKey] = oldValue[k];
            }
            // recursive 처리
            newValue.values['recursive'] = oldValue.recursive ? true : false;
          });
          break;
        case 'chgrp':
          Object.keys(oldValue).forEach(k => newValue.values[k.replace('@', '')] = oldValue[k]);
          // recursive 처리
          newValue.values['recursive'] = oldValue.recursive ? true : false;
          break;
      }

      return newValue;
    };
    // convert 실행
    Object.keys(tagBody).forEach(k => {
      let cmdReg = /^[a-z]+![0-9]+/; // ex. mkdir!0
      if(cmdReg.test(k)){
        let cmd = k.split('!')[0];
        let index = k.split('!')[1];
        commandArr[index] = convertCmdValue(cmd, tagBody[k]);
      }       
    });

    model.props.general.command = commandArr;

    // console.log(JSON.stringify(model.props));
  }
  
  _ssh(model, tagBody) {
    model.props = {
      'general': {    
        'config': {
          'host': this._getText(tagBody.host),
          'command': this._getText(tagBody.command),
          'capture-output': tagBody['capture-output'] ? true : false,
        }
      }
    };
    let targetMap = {
      'args': 'general.config.args'
    };
    [ 'args' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });
  }

  ['_sub-workflow'](model, tagBody) {
    model.props = {
      'general': { 
        'config': {
          'app-path': this._getText(tagBody['app-path']),
          'propagate-configuration': tagBody['propagate-configuration'] ? true : false,
        },
        'configuration': []
      }
    };
    
    let targetMap = {
      'configuration': 'general.configuration'
    };

    [ 'configuration' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });  
  }

  _java(model, tagBody) {
    model.props = {
      'general': { 
        'config': {
          'main-class': this._getText(tagBody['main-class']),
          'capture-output': tagBody['capture-output'] ? true : false,
        }
      },
      'advanced': {}
    };
    
    let targetMap = {
      'java-opts': 'general.config.java-opts'
    };

    [ 'java-opts' ].forEach(k => {
      this._addProp(model.props, k, this._getText(tagBody[k]), targetMap );
    });
    [ 'prepare', 'configuration', 'arg', 'file', 'archive' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]));
    });   
  }

  _email(model, tagBody) {
    model.props = {
      'general': { 
        'config': {
          'to': this._getText(tagBody.to),
          'subject': this._getText(tagBody.subject),
          'body': this._getText(tagBody.body)
        }
      }
    };

    let targetMap = {
      'cc': 'general.config.cc',
      'content_type': 'general.config.content_type'
    };

    [ 'cc', 'content_type' ].forEach(k => {
      this._addProp(model.props, k, this._getText(tagBody[k]), targetMap );
    });
  }

  _shell(model, tagBody) {
    model.props = {
      'general': {
        'config': {
          'capture-output': tagBody['capture-output'] ? true : false
        },
        'exec': {
          'command': this._getText(tagBody.exec)
        }
      },
      'advanced': {}
    };

    let targetMap = {
      'env-var': 'advanced.env-var'
    };
    [ 'env-var', 'prepare', 'configuration', 'argument', 'archive', 'file' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });
  }

  _hive(model, tagBody) {
    model.props = {
      'general': {
        'config': {
          'hiveOption': tagBody.script ? 'script' : 'query'
        }
      },
      'advanced': {}
    };
    tagBody.script ? model.props.general.script = {
      script: this._getText(tagBody.script) 
    } : model.props.general.query = {
      query: this._getText(tagBody.query) 
    };
    
    [ 'argument', 'param', 'archive', 'file', 'prepare', 'configuration' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]));
    });
  }

  _sqoop(model, tagBody) {
    model.props = {
      'general': { 
        'config': {}
      },
      'advanced': {}
    };
    
    let targetMap = {
      'command': 'general.config.command',
      'arg': 'general.config.arg'
    };
    let isArg, isCmd;
    tagBody.arg? isArg = 'arg': isCmd = 'command';
    [ isCmd ].forEach(k => {
      this._addProp(model.props, k, this._getText(tagBody[k]), targetMap );
    });
    [ isArg, 'prepare', 'configuration', 'file', 'archive' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });
  }

  _distcp(model, tagBody) {
    model.props = {
      'general': { 
      },
      'advanced': {}
    };
    
    let targetMap = {
      'java-opts': 'general.config.java-opts',
      'arg': 'general.arg',
    };

    [ 'java-opts' ].forEach(k => {
      this._addProp(model.props, k, this._getText(tagBody[k]), targetMap );
    });
    [ 'prepare', 'configuration', 'arg' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });
  }

  _spark(model, tagBody) {
    model.props = {
      'general': { 
        'config': {
          'name': this._getText(tagBody.name),
          'class': this._getText(tagBody.class),
          'jar': this._getText(tagBody.jar)
        }
      },
      'option': {},
      'advanced': {}
    };
    
    let targetMap = {
      'spark-opts': 'option.option.spark-opts',
      'master': 'general.config.master',
      'arg': 'option.arg',
      'mode': 'option.option.mode'
    };

    [ 'master', 'mode', 'spark-opts' ].forEach(k => {
      this._addProp(model.props, k, this._getText(tagBody[k]), targetMap );
    });
    [ 'prepare', 'configuration', 'arg', 'archive', 'file' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]), targetMap);
    });
  }

  _hive2(model, tagBody) {
    model.props = {
      'general': {
        'config': {
          'jdbc-url': this._getText(tagBody['jdbc-url']),
          'password': this._getText(tagBody['password']),
          'hiveOption': tagBody.script ? 'script' : 'query'
        }
      },
      'advanced': {}
    };
    tagBody.script ? model.props.general.script = {
      script: tagBody.script['#text'] 
    } : model.props.general.query = {
      query: tagBody.query['#text']
    };
    
    [ 'argument', 'param', 'archive', 'file', 'prepare', 'configuration' ].forEach(k => {
      this._addProp(model.props, k, this._convert(k, tagBody[k]));
    });
  }

  _addProp(props, propKey, propValue, targetMap) {
    //console.log(propKey, targetMap);
    let default_target = {
      'prepare': 'advanced.prepare',
      'archive': 'advanced.archive',
      'file': 'advanced.file',
      'argument': 'advanced.argument',
      'arg': 'advanced.arg',
      'param': 'advanced.param',
      'configuration': 'advanced.configuration'
    };
    Object.assign(default_target, targetMap);
    let target = default_target[propKey];

    if(!propValue) return;

    let p = target.split('.');
    let pr = props;
    for(let i = 0; i < p.length - 1; i++) {
      !pr[p[i]] ? pr[p[i]] = {} : '';
      pr = pr[p[i]];
    }
    pr[p[p.length - 1]] = propValue;
  }

  _convert(key, value) {
    if(!value) return;
    let keyMap = {
      configuration: 'configuration',
      prepare: 'prepare',
      argument: 'dynamic',
      archive: 'dynamic',
      file: 'dynamic',
      param: 'dynamic',
      args: 'dynamic',
      arg: 'dynamic',
      'env-var': 'dynamic',
    };
    return this[`_convert_${keyMap[key]}`](value);
  }

  _convert_dynamic(text) {
    let arr = [];
    [].concat(text).forEach(i => arr.push( this._getText(i)));
    return arr;
  }

  _convert_prepare(pre) {
    let arr = [];
    [].concat(pre).forEach(k => {
      const ocmd = Object.keys(k)[0];
      const cmd = ocmd.split('!')[0];
      let values = {};
      Object.keys(k[ocmd]).forEach(a => {
        values[a.split('@')[1]] = k[ocmd][a];
      });
      arr.push({ key: cmd, values: values });
    });
    return arr;
  }

  _convert_configuration(conf) {
    let arr = [];
    [].concat(conf).forEach(k => {
      arr.push({
        name: this._getText(k.property.name),
        value: this._getText(k.property.value)
      });
    });
    return arr;
  }

  _getText(obj){
    if(!obj) return;
    return obj['#text'];
  }
}