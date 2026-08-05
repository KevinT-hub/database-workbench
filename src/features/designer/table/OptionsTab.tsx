// 表设计器“选项”Tab：引擎/字符集/排序规则/自增值/注释。

import React from 'react';
import { HTMLSelect, InputGroup, TextArea, FormGroup } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';
import { MYSQL_CHARSETS, MYSQL_COLLATIONS, MYSQL_ENGINES, type TableOptions } from './designerTypes';

interface OptionsTabProps {
  tableOptions: TableOptions;
  onOptionsChange: React.Dispatch<React.SetStateAction<TableOptions>>;
}

export const OptionsTab: React.FC<OptionsTabProps> = ({ tableOptions, onOptionsChange }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-[500px] p-4">
      <FormGroup label={t('designerTab.options.engine')} labelInfo="">
        <HTMLSelect
          value={tableOptions.engine}
          onChange={(e) => onOptionsChange(prev => ({ ...prev, engine: e.target.value }))}
          options={MYSQL_ENGINES.map(e => ({ value: e, label: e }))}
        />
      </FormGroup>
      <FormGroup label={t('designerTab.options.charset')}>
        <HTMLSelect
          value={tableOptions.charset}
          onChange={(e) => {
            const newCharset = e.target.value;
            const defaultCollation = MYSQL_COLLATIONS[newCharset]?.[0] || '';
            onOptionsChange(prev => ({
              ...prev,
              charset: newCharset,
              collation: defaultCollation,
            }));
          }}
          options={MYSQL_CHARSETS.map(c => ({ value: c, label: c }))}
        />
      </FormGroup>
      <FormGroup label={t('designerTab.options.collation')}>
        <HTMLSelect
          value={tableOptions.collation}
          onChange={(e) => onOptionsChange(prev => ({ ...prev, collation: e.target.value }))}
          options={tableOptions.charset ? MYSQL_COLLATIONS[tableOptions.charset]?.map(c => ({ value: c, label: c })) || [] : []}
          disabled={!tableOptions.charset}
        />
      </FormGroup>
      <FormGroup label={t('designerTab.options.comment')}>
        <TextArea
          value={tableOptions.comment}
          onChange={(e) => onOptionsChange(prev => ({ ...prev, comment: e.target.value }))}
          placeholder={t('designerTab.options.placeholders.comment')}
          rows={3}
        />
      </FormGroup>
      <FormGroup label={t('designerTab.options.autoIncrement')}>
        <InputGroup
          value={tableOptions.autoIncrement}
          onChange={(e) => onOptionsChange(prev => ({ ...prev, autoIncrement: e.target.value }))}
          placeholder={t('designerTab.options.placeholders.autoIncrement')}
        />
      </FormGroup>
    </div>
  );
};

