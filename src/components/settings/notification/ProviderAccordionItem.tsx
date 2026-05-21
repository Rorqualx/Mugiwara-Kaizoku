/**
 * Provider Accordion Item Component
 *
 * Reusable accordion item wrapper for notification providers
 *
 * @module components/settings/notification/ProviderAccordionItem
 */
import React from 'react';

import { Accordion } from '@mantine/core';
import Image from 'next/image';

import classes from '../notification.module.css';

interface ProviderAccordionItemProps {
  value: string;
  logoSrc: string;
  logoAlt: string;
  title: string;
  children: React.ReactNode;
}

/**
 * Reusable accordion item for notification providers
 *
 * @param props - Component props
 * @returns Rendered accordion item with provider logo
 */
export function ProviderAccordionItem({
  value,
  logoSrc,
  logoAlt,
  title,
  children,
}: ProviderAccordionItemProps): React.ReactElement {
  return (
    <Accordion.Item value={value}>
      <Accordion.Control
        {...(classes['accordionControl'] !== undefined && {
          classNames: { control: classes['accordionControl'] }
        })}
        icon={
          <div className={classes['logoWrapper']}>
            <Image
              src={logoSrc}
              width={20}
              height={20}
              alt={logoAlt}
              priority
            />
          </div>
        }
      >
        {title}
      </Accordion.Control>
      <Accordion.Panel>{children}</Accordion.Panel>
    </Accordion.Item>
  );
}
