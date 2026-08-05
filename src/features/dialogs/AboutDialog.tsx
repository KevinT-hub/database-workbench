import React from 'react';
import { Dialog, Classes, Button } from '@blueprintjs/core';
import { useTranslation } from 'react-i18next';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('dialog.about.title')}
      icon="info-sign"
    >
      <div className={Classes.DIALOG_BODY}>
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <h2 className="m-0 text-xl font-semibold text-app-text">Database Workbench</h2>
          <p className="m-0 text-[13px] text-app-text opacity-70">
            {t('dialog.about.version', { version: '0.1.0' })}
          </p>
          <p className="m-0 max-w-[420px] text-[13px] leading-relaxed text-app-text">
            {t('dialog.about.description')}
          </p>
          <div className="my-3 h-px w-3/4 bg-[var(--app-text)] opacity-15" />
          <div className="flex flex-col gap-1 text-[13px] text-app-text">
            <p><strong>{t('dialog.about.techStack')}:</strong> Tauri + React + TypeScript</p>
            <p><strong>{t('dialog.about.uiLibrary')}:</strong> BlueprintJS</p>
            <p><strong>{t('dialog.about.license')}:</strong> MIT License</p>
          </div>
          <div className="mt-1 text-[12px] text-app-text opacity-70">
            <p>{t('dialog.about.copyright')}</p>
          </div>
        </div>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button intent="primary" onClick={onClose}>
            {t('common.ok')}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
